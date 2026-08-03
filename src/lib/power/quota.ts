/**
 * 算力配额管理
 *
 * 借鉴 new-api 的 Quota 设计：
 * - 用户有总配额（算力余额）
 * - 支持每日用量限制（防滥用）
 * - 支持按功能配额（成本控制）
 *
 * 与现有 power 模块关系：
 * - power.ts 管"余额扣减"（账本）
 * - quota.ts 管"限额控制"（闸门）
 * - 二者配合：先过闸门（quota）再记账（power）
 */

import { db } from '@/storage/database/db';
import { createLogger } from '@/lib/error-handler';
import { sql } from 'drizzle-orm';

const logger = createLogger('power-quota');

export interface QuotaConfig {
  /** 用户每日消耗上限（0 = 不限） */
  dailyLimit: number;
  /** 用户每月消耗上限（0 = 不限） */
  monthlyLimit: number;
  /** 单任务最大消耗（防超大任务） */
  perTaskLimit: number;
}

export const DEFAULT_QUOTA: QuotaConfig = {
  dailyLimit: 1000,     // 默认每日 1000 算力
  monthlyLimit: 20000,  // 默认每月 20000
  perTaskLimit: 200,    // 单任务最多 200（视频类 50 足够）
};

/**
 * 查询用户当日已消耗算力
 */
export async function getDailyUsage(userId: string): Promise<number> {
  if (!db) return 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const rows = await db.execute(
      sql`SELECT COALESCE(SUM(ABS(amount)), 0) AS total
          FROM power_transactions
          WHERE user_id = ${userId} AND type = 'consume' AND created_at >= ${todayStart}`
    );
    return Number(rows.rows?.[0]?.total ?? 0);
  } catch (err) {
    logger.warn('查询每日用量失败', err);
    return 0;
  }
}

/**
 * 查询用户当月已消耗算力
 */
export async function getMonthlyUsage(userId: string): Promise<number> {
  if (!db) return 0;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  try {
    const rows = await db.execute(
      sql`SELECT COALESCE(SUM(ABS(amount)), 0) AS total
          FROM power_transactions
          WHERE user_id = ${userId} AND type = 'consume' AND created_at >= ${monthStart}`
    );
    return Number(rows.rows?.[0]?.total ?? 0);
  } catch (err) {
    logger.warn('查询月度用量失败', err);
    return 0;
  }
}

/**
 * 检查任务是否在配额内
 *
 * @returns { ok, reason?, remaining? }
 */
export async function checkQuota(
  userId: string,
  cost: number,
  config: QuotaConfig = DEFAULT_QUOTA
): Promise<{ ok: boolean; reason?: 'daily' | 'monthly' | 'per_task' | 'balance'; remaining?: number }> {
  // 1. 单任务上限
  if (config.perTaskLimit > 0 && cost > config.perTaskLimit) {
    return { ok: false, reason: 'per_task', remaining: config.perTaskLimit - cost };
  }

  // 2. 每日上限
  if (config.dailyLimit > 0) {
    const daily = await getDailyUsage(userId);
    if (daily + cost > config.dailyLimit) {
      return { ok: false, reason: 'daily', remaining: Math.max(0, config.dailyLimit - daily) };
    }
  }

  // 3. 每月上限
  if (config.monthlyLimit > 0) {
    const monthly = await getMonthlyUsage(userId);
    if (monthly + cost > config.monthlyLimit) {
      return { ok: false, reason: 'monthly', remaining: Math.max(0, config.monthlyLimit - monthly) };
    }
  }

  // 4. 余额检查（复用现有 checkUserPower）
  const { checkUserPower } = await import('@/lib/ai-service/power-helper');
  const hasBalance = await checkUserPower(userId, cost);
  if (!hasBalance) {
    return { ok: false, reason: 'balance', remaining: 0 };
  }

  return { ok: true };
}

/**
 * 给用户返回友好的配额错误信息
 */
export function quotaErrorMessage(reason: string, remaining?: number): string {
  switch (reason) {
    case 'daily':
      return `今日算力已达上限（剩余 ${remaining ?? 0}），请明天再试或充值升级`;
    case 'monthly':
      return `本月算力已达上限（剩余 ${remaining ?? 0}），请升级套餐`;
    case 'per_task':
      return `单任务算力超出限制（最大 ${remaining ?? 0}）`;
    case 'balance':
      return '算力余额不足，请充值';
    default:
      return '配额检查未通过';
  }
}
