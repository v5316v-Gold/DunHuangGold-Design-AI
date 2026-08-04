/**
 * Phase 6.1 · 算力预留表（Power Reservations）
 *
 * ADR-008（Power Ledger：账户/流水/预留）
 *
 * 三态生命周期：
 *   reserved → consumed（任务成功，正式扣减）
 *   reserved → released（任务失败/取消，释放预留）
 *
 * 预留不立即改余额；consumed 才写 power_transactions 流水。
 */

import { pgTable, uuid, varchar, integer, text, timestamp, index, boolean } from 'drizzle-orm/pg-core';

export const powerReservations = pgTable(
  'power_reservations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    /** 关联任务 ID */
    taskId: varchar('task_id', { length: 255 }),
    /** 功能 ID */
    featureId: varchar('feature_id', { length: 50 }).notNull(),
    /** 预扣算力 */
    amount: integer('amount').notNull(),
    /** 状态：reserved / consumed / released */
    status: varchar('status', { length: 20 }).default('reserved').notNull(),
    /** 幂等键（防双扣，与 idempotency 打通） */
    idempotencyKey: varchar('idempotency_key', { length: 255 }),
    /** 备注 */
    reason: text('reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    /** 结算时间（consumed/released） */
    settledAt: timestamp('settled_at'),
  },
  (table) => [
    index('idx_pr_user_id').on(table.userId),
    index('idx_pr_task_id').on(table.taskId),
    index('idx_pr_status').on(table.status),
  ]
);
