import { pgTable, uuid, varchar, integer, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from '../schema';

/**
 * 算力流水表
 * 记录所有算力变动：充值、消耗、扣除、退款
 */

export const powerTransactions = pgTable('power_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 用户信息
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userEmail: varchar('user_email', { length: 255 }),
  userNickname: varchar('user_nickname', { length: 100 }),
  
  // 交易信息
  type: varchar('type', { length: 20 }).notNull(), // recharge | consume | deduct | refund | bonus
  amount: integer('amount').notNull(), // 正数=增加，负数=减少
  
  // 余额信息
  balanceBefore: integer('balance_before').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  
  // 附加信息
  reason: text('reason'), // 原因/备注
  operatorId: uuid('operator_id'), // 操作人ID（管理员）
  operatorEmail: varchar('operator_email', { length: 255 }), // 操作人邮箱
  
  // 关联记录（可选，用于追踪具体业务）
  relatedId: varchar('related_id', { length: 255 }), // 关联的业务ID
  
  // 时间戳
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  // 索引
  index('idx_pt_user_id').on(table.userId),
  index('idx_pt_type').on(table.type),
  index('idx_pt_created_at').on(table.createdAt),
  index('idx_pt_operator_id').on(table.operatorId),
]);

// 类型导出
export type PowerTransaction = typeof powerTransactions.$inferSelect;
export type NewPowerTransaction = typeof powerTransactions.$inferInsert;
