/**
 * 内部算力服务 — pipeline 直接调用，绕过 HTTP 认证层
 * 解决内部服务调用时的 auth 传递问题
 */

import { db } from '@/storage/database/db';
import { users, powerLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';

const DEBUG = true;

/**
 * 检查用户算力是否足够
 */
export async function checkUserPower(userId: string, cost: number): Promise<boolean> {
  if (!db) {
    if (DEBUG) console.log('[power-helper] db 为空，跳过算力检查');
    return true;
  }

  try {
    const [user] = await db
      .select({ power: users.power })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (DEBUG) console.log('[power-helper] 用户算力查询:', { userId, cost, found: !!user, power: user?.power });

    if (!user) return false;
    return user.power >= cost;
  } catch (error) {
    if (DEBUG) console.error('[power-helper] 算力查询异常:', error);
    return false;
  }
}

/**
 * 扣除用户算力
 */
export async function deductUserPower(
  userId: string,
  featureId: string,
  cost: number
): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    if (DEBUG) console.log('[power-helper] deduct: db 为空，跳过扣除');
    return { success: true };
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { success: false, error: '用户不存在' };
    }

    if (user.power < cost) {
      return { success: false, error: '算力不足' };
    }

    const newPower = user.power - cost;

    await db
      .update(users)
      .set({ power: newPower, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await db.insert(powerLogs).values({
      userId,
      type: 'deduct',
      amount: -cost,
      balance: newPower,
      reason: `AI服务: ${featureId}`,
    });

    if (DEBUG) console.log('[power-helper] 算力扣除成功:', { userId, cost, newPower });
    return { success: true };
  } catch (error) {
    if (DEBUG) console.error('[power-helper] 扣除算力异常:', error);
    return { success: false, error: String(error) };
  }
}


/**
 * 退还用户算力（任务失败/取消时，与 deduct 对称，ADR-008 release 语义）
 */
export async function refundUserPower(
  userId: string,
  featureId: string,
  cost: number
): Promise<{ success: boolean; error?: string }> {
  if (!db) {
    if (DEBUG) console.log('[power-helper] refund: db 为空，跳过退还');
    return { success: true };
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { success: false, error: '用户不存在' };
    }

    const newPower = user.power + cost;

    await db
      .update(users)
      .set({ power: newPower, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await db.insert(powerLogs).values({
      userId,
      type: 'add',
      amount: cost,
      balance: newPower,
      reason: `任务退还: ${featureId}`,
    });

    if (DEBUG) console.log('[power-helper] 算力退还成功:', { userId, cost, newPower });
    return { success: true };
  } catch (error) {
    if (DEBUG) console.error('[power-helper] 退还算力异常:', error);
    return { success: false, error: String(error) };
  }
}
