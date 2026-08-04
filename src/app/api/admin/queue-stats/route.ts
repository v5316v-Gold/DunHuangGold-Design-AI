/**
 * GET /api/admin/queue-stats
 *
 * Phase 8.4 · 队列指标（queue depth / 完成率 / 失败率）
 *
 * 鉴权：admin。Redis 不可用 → 返回零值（fail-open）。
 */

import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { requireAuth } from '@/lib/auth';
import { ApiErrors, fail, ok } from '@/lib/api/envelope';
import { getQueueStats } from '@/lib/queue/task-queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return ApiErrors.authRequired('req');
  const requestId = request.headers.get('X-Request-Id') || `req_${randomUUID()}`;

  if (user.role !== 'admin') {
    return fail('PERMISSION_DENIED', '需要管理员角色', { requestId });
  }

  try {
    const stats = await getQueueStats();
    const total = stats.waiting + stats.active + stats.completed + stats.failed + stats.delayed;
    const completionRate = total > 0 ? (stats.completed / total) * 100 : 0;
    const failureRate = stats.completed + stats.failed > 0
      ? (stats.failed / (stats.completed + stats.failed)) * 100
      : 0;

    return ok(
      {
        ...stats,
        total,
        completionRate: Number(completionRate.toFixed(2)),
        failureRate: Number(failureRate.toFixed(2)),
        updatedAt: new Date().toISOString(),
      },
      { requestId }
    );
  } catch {
    // Redis 不可用 → 零值
    return ok(
      {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
        completionRate: 0,
        failureRate: 0,
        updatedAt: new Date().toISOString(),
        degraded: true,
      },
      { requestId }
    );
  }
}
