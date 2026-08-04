import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { probeDatabaseNow } from '@/db/health';

/**
 * 健康检查端点（增强版）
 *
 * 任务6：真正探测依赖（不再只看 db 对象非 null）：
 *   - app: 进程存活
 *   - database: 真实 SELECT 1（无 DATABASE_URL → skipped）
 *   - redis: 真实 PING（无 REDIS_URL → skipped）
 *
 * 用法: GET /api/health
 * 用于监控 / 负载均衡 / Docker healthcheck（compose web service 依赖 200）
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  // 1. app
  const checks: Record<string, unknown> = {
    app: 'ok',
  };

  // 2. database 真实探测
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

  // 3. redis 真实探测
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

  // 4. AI key 配置状态（不泄露值，只报是否配置）
  const aiKeys = ['MINIMAX_API_KEY', 'QWEN_API_KEY', 'ZHIPU_API_KEY', 'MESHY_API_KEY'];
  checks.ai = Object.fromEntries(
    aiKeys.map((k) => [k, process.env[k] ? 'configured' : 'missing'])
  );

  const status: 'ok' | 'degraded' = Object.values(checks)
    .filter((v) => typeof v === 'string')
    .some((v) => v === 'error')
    ? 'degraded'
    : 'ok';

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '0.1.0',
      checks,
    },
    {
      status: status === 'ok' ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
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
