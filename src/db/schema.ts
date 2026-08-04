/**
 * 数据库表结构定义
 * 
 * 表定义已拆分至 schema/_tables.ts（各表独立文件）
 * 本文件：re-export 所有表 + 定义 relations
 * 
 * 使用方式（向后兼容）：
 *   import { users, works } from '@/db/schema';
 */

export * from './schema/_tables';
export * from './schema/features';
export * from './schema/power-reservations';
export * from './schema/workflow-versions';
export * from './schema/providers';

// ==================== 关系定义 ====================
import { relations } from 'drizzle-orm';
import {
  users, powerLogs, powerTransactions, works, tasks, sessions, favorites,
} from './schema/_tables';

export const usersRelations = relations(users, ({ many }) => ({
  powerLogs: many(powerLogs),
  powerTransactions: many(powerTransactions),
  works: many(works),
  tasks: many(tasks),
  sessions: many(sessions),
}));

export const powerTransactionsRelations = relations(powerTransactions, ({ one }) => ({
  user: one(users, {
    fields: [powerTransactions.userId],
    references: [users.id],
  }),
}));

export const powerLogsRelations = relations(powerLogs, ({ one }) => ({
  user: one(users, {
    fields: [powerLogs.userId],
    references: [users.id],
  }),
}));

export const worksRelations = relations(works, ({ one }) => ({
  user: one(users, {
    fields: [works.userId],
    references: [users.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  work: one(works, {
    fields: [favorites.workId],
    references: [works.id],
  }),
}));

// ==================== 类型导出 ====================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type PowerLog = typeof powerLogs.$inferSelect;
export type NewPowerLog = typeof powerLogs.$inferInsert;
export type ApiConfig = typeof import('./schema/_tables').apiConfigs.$inferSelect;
export type NewApiConfig = typeof import('./schema/_tables').apiConfigs.$inferInsert;
export type Work = typeof works.$inferSelect;
export type NewWork = typeof works.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Favorite = typeof favorites.$inferSelect;
export type NewFavorite = typeof favorites.$inferInsert;
export type SystemSetting = typeof import('./schema/_tables').systemSettings.$inferSelect;
export type PromptRule = typeof import('./schema/_tables').promptRules.$inferSelect;
export type TranslateSetting = typeof import('./schema/_tables').translateSettings.$inferSelect;
export type Model = typeof import('./schema/_tables').models.$inferSelect;
export type PowerReservation = typeof import('./schema/power-reservations').powerReservations.$inferSelect;
export type NewPowerReservation = typeof import('./schema/power-reservations').powerReservations.$inferInsert;
export type NewModel = typeof import('./schema/_tables').models.$inferInsert;
