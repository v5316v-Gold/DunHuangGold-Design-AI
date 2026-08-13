/**
 * Phase 5.1 · StatsRepository（数据概览聚合查询）
 *
 * 职责：dashboard-stats 路由的聚合统计读。
 * 未来扩展：用户行为统计、流量统计、算力消耗趋势等都通过此 repo 统一聚合。
 */
import { eq, sql, gte, count } from 'drizzle-orm';
import { db } from '@/db';
import { users, works, tasks, powerLogs } from '@/db/schema/_tables';
import { features } from '@/db/schema/features';
import { withRetry } from './db-retry';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface DashboardStats {
  users: { total: number; today: number; activePower: number };
  works: { total: number; today: number };
  tasks: { total: number; pending: number; processing: number; completed: number; failed: number };
  power: { totalConsumed: number; todayConsumed: number; totalBalance: number };
  features: { enabled: number; disabled: number; total: number };
  generatedAt: string;
  source: 'db' | 'fallback';
}

export class StatsRepository {
  async dashboard(): Promise<DashboardStats> {
    const fallback: DashboardStats = {
      users: { total: 0, today: 0, activePower: 0 },
      works: { total: 0, today: 0 },
      tasks: { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 },
      power: { totalConsumed: 0, todayConsumed: 0, totalBalance: 0 },
      features: { enabled: 17, disabled: 0, total: 17 },
      generatedAt: new Date().toISOString(),
      source: 'fallback',
    };

    if (!db) return fallback;

    const today = new Date(Date.now() - ONE_DAY_MS);

    try {
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
        withRetry(() => (db as NonNullable<typeof db>).select({ c: count() }).from(users)),
        withRetry(() => (db as NonNullable<typeof db>).select({ c: count() }).from(users).where(gte(users.createdAt, today))),
        withRetry(() => (db as NonNullable<typeof db>).select({ c: count() }).from(works)),
        withRetry(() => (db as NonNullable<typeof db>).select({ c: count() }).from(works).where(gte(works.createdAt, today))),
        withRetry(() => (db as NonNullable<typeof db>).select({ c: count() }).from(tasks)),
        withRetry(() => (db as NonNullable<typeof db>).select({ c: count() }).from(tasks).where(eq(tasks.status, 'pending'))),
        withRetry(() => (db as NonNullable<typeof db>).select({ c: count() }).from(tasks).where(eq(tasks.status, 'processing'))),
        withRetry(() => (db as NonNullable<typeof db>).select({ c: count() }).from(tasks).where(eq(tasks.status, 'completed'))),
        withRetry(() => (db as NonNullable<typeof db>).select({ c: count() }).from(tasks).where(eq(tasks.status, 'failed'))),
        withRetry(() =>
          (db as NonNullable<typeof db>)
            .select({ s: sql<number>`COALESCE(SUM(${users.power}), 0)::int` })
            .from(users)
        ),
        withRetry(() =>
          (db as NonNullable<typeof db>)
            .select({ s: sql<number>`COALESCE(SUM(ABS(${powerLogs.amount})), 0)::int` })
            .from(powerLogs)
            .where(
              sql`${powerLogs.type} = 'deduct' AND ${powerLogs.createdAt} >= ${today}`
            )
        ),
        withRetry(() => (db as NonNullable<typeof db>).select({ c: count() }).from(features).where(eq(features.enabled, true))),
        withRetry(() => (db as NonNullable<typeof db>).select({ c: count() }).from(features).where(eq(features.enabled, false))),
      ]);

      return {
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
          totalConsumed: powerTodayRow[0]?.s ?? 0,
          todayConsumed: powerTodayRow[0]?.s ?? 0,
          totalBalance: powerSumRow[0]?.s ?? 0,
        },
        features: {
          enabled: activeFeaturesRow[0]?.c ?? 0,
          disabled: disabledFeaturesRow[0]?.c ?? 0,
          total: 17,
        },
        generatedAt: new Date().toISOString(),
        source: 'db',
      };
    } catch (err) {
      console.error('[StatsRepository] dashboard failed:', err);
      return fallback;
    }
  }
}

export const statsRepository = new StatsRepository();
