/**
 * /api/admin/dashboard-stats
 * 管理员 · 数据概览统计
 *
 * GET /api/admin/dashboard-stats
 *   Resp: { success, data: {
 *     users:   { total, today, activePower },
 *     works:   { total, today },
 *     tasks:   { total, pending, processing, completed, failed },
 *     power:   { totalConsumed, todayConsumed, totalBalance },
 *     features:{ enabled, disabled, total },
 *     generatedAt, source
 *   } }
 *
 * 前端字段映射（admin/page.tsx）：
 *   totalUsers ← users.total；activeUsers ← users.today
 *   totalGenerated ← works.total；todayGenerated ← works.today
 *   totalPower ← power.totalBalance；usedPower ← power.todayConsumed
 *   taskTotal ← tasks.total；taskPending ← tasks.pending
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { statsRepository } from '@/db/repositories/stats-repository';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  try {
    const stats = await statsRepository.dashboard();
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: stats,
    });
  } catch (err) {
    // 仓库内部已兜底返回 fallback，此处仅防御性兜底
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        users: { total: 0, today: 0, activePower: 0 },
        works: { total: 0, today: 0 },
        tasks: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
        power: { totalConsumed: 0, todayConsumed: 0, totalBalance: 0 },
        features: { enabled: 0, disabled: 0, total: 0 },
        generatedAt: new Date().toISOString(),
        source: 'fallback',
      },
      warning: `统计失败: ${(err as Error).message}`,
    });
  }
}
