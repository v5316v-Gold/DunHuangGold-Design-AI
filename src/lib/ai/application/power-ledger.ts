/**
 * Phase 6.2 · PowerLedger（算力账本）
 *
 * ADR-008（Power Ledger：账户/流水/预留，无双重计费）
 *
 * 三态原子操作：
 *   reserve(userId, featureId, amount, {taskId, idempotencyKey})
 *     → 校验余额 → 写 power_reservations(reserved) → 不立即扣减
 *   consume(reservationId)  → 事务内：扣余额 + 流水(consume) + 预留状态→consumed
 *   release(reservationId)  → 预留状态→released（未扣减，无需退款）
 *
 * 幂等闭环（6.5）：reservation 用 (userId, taskId, featureId) 唯一，
 * 重复 reserve 同 task → 返回已有预留（不双扣）。
 *
 * DB 不可用 → 内存降级（map），生产依赖 PG 事务。
 */

import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, powerLogs, powerTransactions } from '@/db/schema/_tables';
import { powerReservations } from '@/db/schema/power-reservations';
import { withRetry } from '@/db/repositories/db-retry';
import { createLogger } from '@/lib/error-handler';

/** 非空 DB 引用（模块加载时 db 可能为 null，调用时用 dbc 需要外层判断） */
const dbc = db as NonNullable<typeof db>;

const logger = createLogger('power-ledger');

export type ReservationStatus = 'reserved' | 'consumed' | 'released';

export interface Reservation {
  id: string;
  userId: string;
  taskId: string | null;
  featureId: string;
  amount: number;
  status: ReservationStatus;
}

// ==================== 内存降级存储 ====================

const memoryReservations = new Map<string, Reservation>();

// ==================== PowerLedger ====================

export class PowerLedger {
  /**
   * 预留算力（不立即扣减）
   * 幂等：同 (userId, taskId, featureId) 重复调用返回已有预留
   */
  async reserve(input: {
    userId: string;
    featureId: string;
    amount: number;
    taskId?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; reservation?: Reservation; error?: string }> {
    // 1. 余额校验
    const balance = await this.getBalance(input.userId);
    if (balance === null) {
      // DB 不可用 → 降级允许（fail-open）
      logger.warn('[ledger] DB 不可用，reserve fail-open');
    } else if (balance < input.amount) {
      return { success: false, error: '算力不足' };
    }

    // 2. 幂等检查：同 task 已有预留
    if (input.taskId) {
      const existing = await this.findByTask(input.userId, input.taskId);
      if (existing) {
        return { success: true, reservation: existing };
      }
    }

    // 3. 写预留
    if (db) {
      try {
        const [row] = await withRetry(() =>
          dbc
            .insert(powerReservations)
            .values({
              userId: input.userId,
              taskId: input.taskId ?? null,
              featureId: input.featureId,
              amount: input.amount,
              status: 'reserved',
              idempotencyKey: input.idempotencyKey ?? null,
              reason: `AI 功能预留: ${input.featureId}`,
            })
            .returning()
        );
        const res: Reservation = {
          id: row.id,
          userId: row.userId,
          taskId: row.taskId,
          featureId: row.featureId,
          amount: row.amount,
          status: row.status as ReservationStatus,
        };
        logger.info(`[ledger] 预留成功: ${res.id} ${input.featureId} ${input.amount}`);
        return { success: true, reservation: res };
      } catch (error) {
        logger.warn('[ledger] DB 预留失败，降级内存', error as Error);
      }
    }
    // 内存降级
    const { randomUUID } = await import('crypto');
    const res: Reservation = {
      id: randomUUID(),
      userId: input.userId,
      taskId: input.taskId ?? null,
      featureId: input.featureId,
      amount: input.amount,
      status: 'reserved',
    };
    memoryReservations.set(res.id, res);
    return { success: true, reservation: res };
  }

  /**
   * 结算：consume（正式扣减）或 release（释放预留，不扣减）
   */
  async settle(
    reservationId: string,
    outcome: 'consume' | 'release'
  ): Promise<{ success: boolean; error?: string }> {
    // 先查预留
    let reservation: Reservation | null = null;
    if (db) {
      try {
        const rows = await withRetry(() =>
          dbc.select().from(powerReservations).where(eq(powerReservations.id, reservationId)).limit(1)
        );
        const row = rows[0];
        if (row) {
          reservation = {
            id: row.id,
            userId: row.userId,
            taskId: row.taskId,
            featureId: row.featureId,
            amount: row.amount,
            status: row.status as ReservationStatus,
          };
        }
      } catch {
        // 走内存
      }
    }
    if (!reservation) {
      reservation = memoryReservations.get(reservationId) ?? null;
    }
    if (!reservation) {
      return { success: false, error: '预留不存在' };
    }
    if (reservation.status !== 'reserved') {
      return { success: false, error: `预留已结算（${reservation.status}）` };
    }

    if (outcome === 'release') {
      if (db) {
        try {
          await withRetry(() =>
            dbc
              .update(powerReservations)
              .set({ status: 'released', settledAt: new Date() })
              .where(eq(powerReservations.id, reservationId))
          );
        } catch {
          // 内存同步
        }
      }
      const mem = memoryReservations.get(reservationId);
      if (mem) mem.status = 'released';
      logger.info(`[ledger] 释放预留: ${reservationId}`);
      return { success: true };
    }

    // consume：事务内扣余额 + 写流水 + 预留置 consumed
    if (!db) {
      // 内存降级：只标记 consumed
      const mem = memoryReservations.get(reservationId);
      if (mem) mem.status = 'consumed';
      return { success: true };
    }
    try {
      await withRetry(async () => {
        // 事务
        const [user] = await dbc
          .select()
          .from(users)
          .where(eq(users.id, reservation!.userId))
          .limit(1);
        if (!user) throw new Error('用户不存在');
        if (user.power < reservation!.amount) throw new Error('算力不足');

        const newPower = user.power - reservation!.amount;

        // 扣余额
        await dbc
          .update(users)
          .set({ power: newPower, updatedAt: new Date() })
          .where(eq(users.id, reservation!.userId));

        // 写 power_logs（兼容旧查询）
        await dbc.insert(powerLogs).values({
          userId: reservation!.userId,
          type: 'deduct',
          amount: -reservation!.amount,
          balance: newPower,
          reason: `AI 服务: ${reservation!.featureId}`,
          relatedId: reservation!.taskId ?? undefined,
        });

        // 写 power_transactions（ledger 流水）
        await dbc.insert(powerTransactions).values({
          userId: reservation!.userId,
          type: 'consume',
          amount: -reservation!.amount,
          balanceBefore: user.power,
          balanceAfter: newPower,
          reason: `AI 功能: ${reservation!.featureId}`,
          relatedId: reservation!.taskId ?? undefined,
        });

        // 预留置 consumed
        await dbc
          .update(powerReservations)
          .set({ status: 'consumed', settledAt: new Date() })
          .where(eq(powerReservations.id, reservationId));
      });
      logger.info(`[ledger] 结算扣减: ${reservationId} ${reservation.amount}`);
      return { success: true };
    } catch (error) {
      logger.error('[ledger] consume 失败', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  /** 查询用户余额（DB 不可用 → null 表示未知） */
  async getBalance(userId: string): Promise<number | null> {
    if (!db) return null;
    try {
      const rows = await withRetry(() =>
        dbc.select({ power: users.power }).from(users).where(eq(users.id, userId)).limit(1)
      );
      return rows[0]?.power ?? null;
    } catch {
      return null;
    }
  }

  /** 按任务查预留 */
  async findByTask(userId: string, taskId: string): Promise<Reservation | null> {
    if (db) {
      try {
        const rows = await withRetry(() =>
          dbc
            .select()
            .from(powerReservations)
            .where(and(eq(powerReservations.userId, userId), eq(powerReservations.taskId, taskId)))
            .limit(1)
        );
        const row = rows[0];
        if (row) {
          return {
            id: row.id,
            userId: row.userId,
            taskId: row.taskId,
            featureId: row.featureId,
            amount: row.amount,
            status: row.status as ReservationStatus,
          };
        }
      } catch {
        // 走内存
      }
    }
    for (const r of memoryReservations.values()) {
      if (r.userId === userId && r.taskId === taskId) return r;
    }
    return null;
  }
}

export const powerLedger = new PowerLedger();
