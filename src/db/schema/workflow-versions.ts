/**
 * Phase 5.4 · 工作流版本表（Workflow Versions）
 *
 * ADR-009（工作流版本不可变）：workflow 变更 = 新版本行，历史版本不可修改。
 *
 * - version 递增（每功能 workflow 从 1 开始）
 * - immutable：已发布版本不更新，新增版本
 */

import { pgTable, varchar, jsonb, text, integer, timestamp, boolean, index, uuid } from 'drizzle-orm/pg-core';

export const workflowVersions = pgTable(
  'workflow_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** 工作流逻辑 ID（对应 workflows.id） */
    workflowId: varchar('workflow_id', { length: 50 }).notNull(),
    /** 版本号（从 1 递增，不可变） */
    version: integer('version').notNull(),
    /** 版本名（如 v1.0 初始版） */
    name: varchar('name', { length: 100 }),
    /** 工作流 JSON 快照（immutable） */
    workflowJson: jsonb('workflow_json').notNull(),
    /** ComfyUI host（该版本专用） */
    comfyuiHost: varchar('comfyui_host', { length: 255 }),
    /** 变更说明 */
    changelog: text('changelog'),
    /** 是否当前激活版本 */
    isActive: boolean('is_active').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    /** 创建人 */
    createdBy: varchar('created_by', { length: 100 }),
  },
  (table) => [
    index('idx_wv_workflow').on(table.workflowId),
    index('idx_wv_workflow_version').on(table.workflowId, table.version),
  ]
);
