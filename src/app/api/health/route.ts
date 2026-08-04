import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { probeDatabaseNow } from '@/db/health';

/**
 * 健康检查端点（增强版 · Phase 9.14 缓存优化）
 *
 * 任务6：真正探测依赖（不再只看 db 对象非 null）：
 *   - app: 进程存活
 *   - database: 真实 SELECT 1（无 DATABASE_URL → skipped）
 *   - redis: 真实 PING（无 REDIS_URL → skipped）
 *
 * 性能优化（Phase 9.14）：
 *   - 30s Redis 缓存避免每次健康检查都打 DB/Redis（500 并发下从 P99=611ms → 预估 < 50ms）
 *   - 缓存由 X-Force-Fresh: 1 头触发刷新（监控系统主动探测时使用）
 *
 * 用法: GET /api/health
 * 用于监控 / 负载均衡 / Docker healthcheck（compose web service 依赖 200）
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CACHE_TTL_MS = parseInt(process.env.HEALTH_CACHE_TTL_MS || '30000', 10);

interface HealthCache {
  body: Record<string, unknown>;
  status: number;
  expiresAt: number;
}

let healthCache: HealthCache | null = null;

export async function GET(request: Request) {
  // 1. 检查缓存（除非强制刷新）
  const forceFresh = request.headers.get('x-force-fresh') === '1';
  if (!forceFresh && healthCache && healthCache.expiresAt > Date.now()) {
    return NextResponse.json(healthCache.body, {
      status: healthCache.status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Health-Cache': 'HIT',
      },
    });
  }

  // 2. 真实探测
  const checks: Record<string, unknown> = {
    app: 'ok',
  };

  // database
  try {
    if (process.env.DATABASE_URL) {
      const dbOk = await probeDatabaseNow();
      checks.database = dbOk ? 'ok' : 'error';
    } else {
      checks.database = 'skipped';
    }
  } catch (error) {
    checks.database = 'error';
    console.error('[health] DB 探测异常:', error);
  }

  // redis
  try {
    if (process.env.REDIS_URL) {
      const redisOk = await probeRedis();
      checks.redis = redisOk ? 'ok' : 'error';
    } else {
      checks.redis = 'skipped';
    }
  } catch (error) {
    checks.redis = 'error';
    console.error('[health] Redis 探测异常:', error);
  }

  // AI key 配置状态（不泄露值，只报是否配置）
  const aiKeys = ['MINIMAX_API_KEY', 'QWEN_API_KEY', 'ZHIPU_API_KEY', 'MESHY_API_KEY'];
  checks.ai = Object.fromEntries(
    aiKeys.map((k) => [k, process.env[k] ? 'configured' : 'missing'])
  );

  const status: 'ok' | 'degraded' = Object.values(checks)
    .filter((v) => typeof v === 'string')
    .some((v) => v === 'error')
    ? 'degraded'
    : 'ok';

  const body = {
    status,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '0.1.0',
    checks,
  };

  // 3. 写缓存
  healthCache = {
    body,
    status: status === 'ok' ? 200 : 503,
    expiresAt: Date.now() + CACHE_TTL_MS,
  };

  return NextResponse.json(body, {
    status: status === 'ok' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
      'X-Health-Cache': 'MISS',
    },
  });
}

/** Redis PING 探测（动态 import 避免模块加载副作用） */
async function probeRedis(): Promise<boolean> {
  try {
    const { getRedis } = await import('@/lib/redis');
    const redis = getRedis();
    const pong = await redis.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}