/**
 * 管理后台 - 数据概览（Dashboard）统计 API
 *
 * 聚合多个数据源（用户/作品/任务/算力）给 dashboard tab
 * 替代之前删的 /api/admin/stats
 *
 * GET /api/admin/dashboard-stats
 *  - 用户总数 / 今日新增
 *  - 作品总数 / 今日生成
 *  - 任务总数 / 各状态分布
 *  - 算力总消耗 / 今日消耗
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db, schema } from '@/db';
import { apiSuccess, unauthorized, internalError } from '@/lib/api-response';
import { sql, gte, count, eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();

  try {
    const today = new Date(Date.now() - ONE_DAY_MS);

    // 默认 fallback（DB 不可用时）
    const fallback = {
      users: { total: 0, today: 0, activePower: 0 },
      works: { total: 0, today: 0 },
      tasks: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
      power: { totalConsumed: 0, todayConsumed: 0, totalBalance: 0 },
      features: { enabled: 0, disabled: 0, total: 17 },
      generatedAt: new Date().toISOString(),
      source: 'fallback' as const,
    };

    if (!db) {
      return apiSuccess(fallback, { error: null });
    }

    // 并行查询各项数据
    const [
      userTotalRow,
      userTodayRow,
      workTotalRow,
      workTodayRow,
      taskTotalRow,
      taskPendingRow,
      taskProcessingRow,
      taskCompletedRow,
      taskFailedRow,
      powerSumRow,
      powerTodayRow,
      activeFeaturesRow,
      disabledFeaturesRow,
    ] = await Promise.all([
      db.select({ c: count() }).from(schema.users),
      db.select({ c: count() }).from(schema.users).where(gte(schema.users.createdAt, today)),
      db.select({ c: count() }).from(schema.works),
      db.select({ c: count() }).from(schema.works).where(gte(schema.works.createdAt, today)),
      db.select({ c: count() }).from(schema.tasks),
      db.select({ c: count() }).from(schema.tasks).where(eq(schema.tasks.status, 'pending')),
      db.select({ c: count() }).from(schema.tasks).where(eq(schema.tasks.status, 'processing')),
      db.select({ c: count() }).from(schema.tasks).where(eq(schema.tasks.status, 'completed')),
      db.select({ c: count() }).from(schema.tasks).where(eq(schema.tasks.status, 'failed')),
      // 算力总余额
      db.select({ s: sql<number>`COALESCE(SUM(${schema.users.power}), 0)::int` }).from(schema.users),
      // 算力今日消耗（power_logs 负向 = 消耗）
      db.select({ s: sql<number>`COALESCE(SUM(ABS(${schema.powerLogs.amount})), 0)::int` })
        .from(schema.powerLogs)
        .where(and(
          eq(schema.powerLogs.type, 'deduct'),
          gte(schema.powerLogs.createdAt, today)
        )),
      db.select({ c: count() }).from(schema.features).where(eq(schema.features.enabled, true)),
      db.select({ c: count() }).from(schema.features).where(eq(schema.features.enabled, false)),
    ]);

    const stats = {
      users: {
        total: userTotalRow[0]?.c ?? 0,
        today: userTodayRow[0]?.c ?? 0,
        activePower: powerSumRow[0]?.s ?? 0,
      },
      works: {
        total: workTotalRow[0]?.c ?? 0,
        today: workTodayRow[0]?.c ?? 0,
      },
      tasks: {
        total: taskTotalRow[0]?.c ?? 0,
        pending: taskPendingRow[0]?.c ?? 0,
        processing: taskProcessingRow[0]?.c ?? 0,
        completed: taskCompletedRow[0]?.c ?? 0,
        failed: taskFailedRow[0]?.c ?? 0,
      },
      power: {
        totalConsumed: powerTodayRow[0]?.s ?? 0, // 今日消耗
        todayConsumed: powerTodayRow[0]?.s ?? 0,
        totalBalance: powerSumRow[0]?.s ?? 0,
      },
      features: {
        enabled: activeFeaturesRow[0]?.c ?? 0,
        disabled: disabledFeaturesRow[0]?.c ?? 0,
        total: 17,
      },
      generatedAt: new Date().toISOString(),
      source: 'db' as const,
    };

    return apiSuccess(stats, { error: null });
  } catch (err) {
    console.error('[api/admin/dashboard-stats] 错误:', err);
    return internalError(err, '数据概览统计失败');
  }
}
