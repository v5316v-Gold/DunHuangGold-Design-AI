/**
 * Workflow Manager（DB 实现）
 *
 * 职责：管理 workflow_templates 表，提供 IWorkflowPort 接口
 */

import { db } from '@/storage/database/db';
import { pgTable, uuid, varchar, integer, jsonb, boolean, text, timestamp, index } from 'drizzle-orm/pg-core';
import { eq, and, desc } from 'drizzle-orm';
import type { AIServiceType } from '@/lib/ai-service/types';
import type { IWorkflowPort, WorkflowInfo } from '../port';

/* eslint-disable @typescript-eslint/no-explicit-any */


// 定义 workflow_templates 表（与 005_add_workflow_templates.sql 一致）
const workflowTemplates = pgTable(
  'workflow_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    serviceType: varchar('service_type', { length: 30 }).notNull(),
    version: integer('version').default(1).notNull(),
    workflowJson: jsonb('workflow_json').notNull(),
    inputSchema: jsonb('input_schema'),
    comfyuiVersion: varchar('comfyui_version', { length: 20 }),
    requiredCustomNodes: jsonb('required_custom_nodes').$type<string[]>().default([]),
    enabled: boolean('enabled').default(true).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

export class WorkflowManager implements IWorkflowPort {
  readonly name = 'workflow-db';

  /**
   * 加载某服务的默认工作流（最新启用版本）
   */
  async loadDefault(serviceType: AIServiceType): Promise<WorkflowInfo | null> {
    if (!db) return null;

    const rows = await db
      .select()
      .from(workflowTemplates)
      .where(
        and(
          eq(workflowTemplates.serviceType, serviceType),
          eq(workflowTemplates.enabled, true)
        )
      )
      .orderBy(desc(workflowTemplates.version))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return this.toWorkflowInfo(row);
  }

  /**
   * 列出所有启用的工作流
   */
  async listEnabled(): Promise<WorkflowInfo[]> {
    if (!db) return [];
    const rows = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.enabled, true));
    return rows.map((r) => this.toWorkflowInfo(r));
  }

  /**
   * 列出某服务的所有版本
   */
  async listByService(serviceType: AIServiceType): Promise<WorkflowInfo[]> {
    if (!db) return [];
    const rows = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.serviceType, serviceType))
      .orderBy(desc(workflowTemplates.version));
    return rows.map((r) => this.toWorkflowInfo(r));
  }

  private toWorkflowInfo(row: any): WorkflowInfo {
    return {
      id: row.id,
      name: row.name,
      serviceType: row.serviceType as AIServiceType,
      version: row.version,
      workflowJson: row.workflowJson,
      inputSchema: row.inputSchema,
      enabled: row.enabled,
    };
  }
}

/**
 * 占位实现（DB 不可用时 fallback）
 */
export class StubWorkflowManager implements IWorkflowPort {
  readonly name = 'workflow-stub';

  async loadDefault(_serviceType: AIServiceType): Promise<WorkflowInfo | null> {
    // 返回最简工作流（让 ComfyUI 用默认 KSampler）
    return {
      id: 'stub',
      name: 'stub',
      serviceType: 'text2img',
      version: 1,
      workflowJson: null,
      enabled: true,
    };
  }

  async listEnabled(): Promise<WorkflowInfo[]> {
    return [];
  }
}