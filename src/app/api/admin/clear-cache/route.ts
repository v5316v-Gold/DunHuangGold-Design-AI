/**
 * /api/admin/clear-cache
 * 管理员 · 清理 Redis 缓存（历史 / 标签 / 翻译缓存）
 *
 * POST /api/admin/clear-cache
 *   Resp: { success, data: { cleared, scanned } }
 *
 * 安全策略：只删除应用缓存前缀的 key，绝不触碰 bull:*（BullMQ 队列）。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getRedis } from '@/lib/redis';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

/** 允许清理的 key 前缀（应用缓存），与 BullMQ(bull:*) / 会话等隔离 */
const CACHE_PREFIXES = [
  'dunhuang:',
  'cache:',
  'translate:',
  'tag:',
  'history:',
  'power:',
  'feature-costs',
];

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  try {
    const redis = getRedis();
    // 分块扫描，避免 KEYS 阻塞大实例；这里管理端操作用 keys 亦可，扫描后按前缀过滤
    const allKeys = await redis.keys('*');
    const targets = allKeys.filter(
      (k) => !k.startsWith('bull:') && CACHE_PREFIXES.some((p) => k.startsWith(p))
    );

    let cleared = 0;
    if (targets.length > 0) {
      cleared = await redis.del(...targets);
    }

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { cleared, scanned: allKeys.length },
    });
  } catch (err) {
    // Redis 不可用：容错返回 success + warning（不 500 崩溃）
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { cleared: 0, scanned: 0 },
      warning: `Redis 清理失败（可能未配置或不可用）: ${(err as Error).message}`,
    });
  }
}
