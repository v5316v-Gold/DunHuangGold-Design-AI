/**
 * 管理后台 - 数据概览（Dashboard）统计 API
 *
 * 聚合多个数据源（用户/作品/任务/算力）给 dashboard tab
 *
 * GET /api/admin/dashboard-stats
 *  - 用户总数 / 今日新增
 *  - 作品总数 / 今日生成
 *  - 任务总数 / 各状态分布
 *  - 算力总消耗 / 今日消耗
 *
 * Phase 5.1：迁移到 StatsRepository（消除 13 处直调 db）
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiSuccess, unauthorized } from '@/lib/api-response';
import { statsRepository } from '@/db/repositories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();

  try {
    const stats = await statsRepository.dashboard();
    return apiSuccess(stats, { error: null });
  } catch (err) {
    console.error('[api/admin/dashboard-stats] 错误:', err);
    return apiSuccess(
      {
        users: { total: 0, today: 0, activePower: 0 },
        works: { total: 0, today: 0 },
        tasks: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
        power: { totalConsumed: 0, todayConsumed: 0, totalBalance: 0 },
        features: { enabled: 0, disabled: 0, total: 17 },
        generatedAt: new Date().toISOString(),
        source: 'fallback' as const,
      },
      { error: 'fallback' }
    );
  }
}
