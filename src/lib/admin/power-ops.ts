/**
 * 后台管理 · 算力调整公共助手
 *
 * 统一「改 users.power + 同步写 power_transactions 流水」的语义，
 * 供 /api/admin/users、/api/admin/users/[id]/recharge、/api/admin/power/recharge 复用。
 *
 * 流水字段（与 _tables.ts 的 powerTransactions 一致）：
 *   type / amount / balance_before / balance_after / reason / operator_id / operator_email
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, powerTransactions } from '@/db/schema/_tables';

export interface AdjustPowerOptions {
  userId: string;
  /** 变动净额：正数=增加（充值/奖励/退款），负数=减少（扣除/消耗） */
  delta: number;
  /** 流水类型：recharge | deduct | bonus | refund | consume */
  type: string;
  reason?: string;
  operatorId?: string | null;
  operatorEmail?: string | null;
  relatedId?: string | null;
}

export interface AdjustPowerResult {
  userId: string;
  balanceBefore: number;
  balanceAfter: number;
  amount: number;
  type: string;
}

/**
 * 调整用户算力并同步写 power_transactions 流水。
 * @returns 变动结果；用户不存在或数据库不可用时返回 null（由调用方决定错误信息）。
 */
export async function adjustUserPower(opts: AdjustPowerOptions): Promise<AdjustPowerResult | null> {
  if (!db) return null;
  const dbc = db as NonNullable<typeof db>;
  try {
    // 事务 + 行锁（FOR UPDATE）：并发充值/扣除不丢更新，余额与流水原子写入
    return await dbc.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, opts.userId))
        .limit(1)
        .for('update');
      if (!user) throw new Error('用户不存在');

      const balanceBefore = user.power;
      const balanceAfter = Math.max(0, balanceBefore + opts.delta);

      await tx
        .update(users)
        .set({ power: balanceAfter, updatedAt: new Date() })
        .where(eq(users.id, opts.userId));

      await tx.insert(powerTransactions).values({
        userId: opts.userId,
        userEmail: user.email,
        userNickname: user.nickname,
        type: opts.type,
        amount: opts.delta,
        balanceBefore,
        balanceAfter,
        reason: opts.reason ?? null,
        operatorId: opts.operatorId ?? null,
        operatorEmail: opts.operatorEmail ?? null,
        relatedId: opts.relatedId ?? null,
      });

      return {
        userId: opts.userId,
        balanceBefore,
        balanceAfter,
        amount: opts.delta,
        type: opts.type,
      };
    });
  } catch (err) {
    console.error('[admin/power-ops] 调整算力失败:', err);
    return null;
  }
}
