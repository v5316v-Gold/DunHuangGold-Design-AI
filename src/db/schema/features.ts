import { pgTable, uuid, varchar, boolean, integer, timestamp, jsonb, text, index } from 'drizzle-orm/pg-core';
import { users } from './_tables';

export const features = pgTable('features', {
  id: varchar('id', { length: 50 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 30 }).notNull(),
  icon: varchar('icon', { length: 50 }),
  cost: integer('cost').default(10).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  defaultExecutor: varchar('default_executor', { length: 50 }).default('third-party').notNull(),
  fallbackExecutors: jsonb('fallback_executors').default([]).$type<string[]>(),
  workflowId: varchar('workflow_id', { length: 50 }),
  loras: jsonb('loras').default([]).$type<Array<{ id: string; weight: number; triggerWords?: string[] }>>(),
  defaultModel: varchar('default_model', { length: 100 }),
  defaultParams: jsonb('default_params').default({}).$type<Record<string, unknown>>(),
  sortOrder: integer('sort_order').default(0).notNull(),
  displayGroup: varchar('display_group', { length: 50 }),
  supportsAIAssistant: boolean('supports_ai_assistant').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
}, (table) => [
  index('features_enabled_idx').on(table.enabled, table.sortOrder),
  index('features_category_idx').on(table.category),
]);
