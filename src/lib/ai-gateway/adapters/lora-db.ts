/**
 * LoRA Manager（DB 实现）
 *
 * 替换 W2 的 InMemoryLoraManager
 * - loras 表存元数据
 * - 文件系统存 .safetensors 文件
 * - 通过 scope 数组过滤适用服务
 */

import { db } from '@/storage/database/db';
import { pgTable, uuid, varchar, text, bigint, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { eq, and, sql } from 'drizzle-orm';
import type { AIServiceType } from '@/lib/ai-service/types';
import type { ILoraPort, LoraInfo } from '../port';

// 定义 loras 表（与 006_add_loras.sql 一致）
const loras = pgTable(
  'loras',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    triggerWords: text('trigger_words').array().notNull().default([]),
    filePath: varchar('file_path', { length: 500 }).notNull(),
    fileHash: varchar('file_hash', { length: 64 }),
    fileSize: bigint('file_size', { mode: 'number' }),
    baseModel: varchar('base_model', { length: 100 }),
    scope: text('scope').array().notNull().default([]),
    previewImage: varchar('preview_image', { length: 500 }),
    enabled: boolean('enabled').default(true).notNull(),
    uploadedBy: uuid('uploaded_by'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_loras_enabled').on(table.enabled),
  ]
);

export class DrizzleLoraManager implements ILoraPort {
  readonly name = 'lora-db';

  /**
   * 加载某服务启用的 LoRA
   */
  async loadActiveLoras(serviceType: AIServiceType): Promise<LoraInfo[]> {
    if (!db) return [];

    const rows = await db
      .select()
      .from(loras)
      .where(
        and(
          eq(loras.enabled, true),
          sql`${loras.scope} @> ARRAY[${serviceType}]::text[]`
        )
      );

    return rows.map(this.toLoraInfo);
  }

  /**
   * 注入 LoRA 到 ComfyUI 工作流 JSON
   * 找到 LoRALoader 节点，依次挂载
   */
  injectIntoWorkflow(workflowJson: unknown, loras: LoraInfo[]): unknown {
    if (!loras.length || !workflowJson) return workflowJson;
    const wf = JSON.parse(JSON.stringify(workflowJson));

    for (const [id, node] of Object.entries(wf as Record<string, any>)) {
      if (node?.class_type === 'LoRALoader' && loras.length > 0) {
        const lora = loras[0];
        node.inputs.lora_name = lora.filePath;
        node.inputs.strength_model = 0.8;
        node.inputs.strength_clip = 0.8;
      }
    }
    return wf;
  }

  /**
   * 把触发词拼接到 prompt 前
   */
  injectTriggers(prompt: string, loras: LoraInfo[]): string {
    if (!loras.length) return prompt;
    const triggers = loras.flatMap((l) => l.triggerWords).join(', ');
    return triggers ? `${triggers}, ${prompt}` : prompt;
  }

  /**
   * 列出所有 LoRA（管理后台用）
   */
  async listAll(): Promise<LoraInfo[]> {
    const all = await this.listAllWithEnabled();
    return all.map((l) => ({
      id: l.id,
      name: l.name,
      triggerWords: l.triggerWords,
      filePath: l.filePath,
      baseModel: l.baseModel,
    }));
  }

  /**
   * 列出所有 LoRA（含 enabled 字段）
   */
  async listAllWithEnabled(): Promise<Array<LoraInfo & { enabled: boolean }>> {
    if (!db) return [];
    const rows = await db.select().from(loras).orderBy(loras.createdAt);
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      triggerWords: row.triggerWords ?? [],
      filePath: row.filePath,
      baseModel: row.baseModel,
      enabled: row.enabled,
    }));
  }

  /**
   * 按 ID 查
   */
  async findById(id: string): Promise<LoraInfo | null> {
    if (!db) return null;
    const rows = await db.select().from(loras).where(eq(loras.id, id)).limit(1);
    return rows[0] ? this.toLoraInfo(rows[0]) : null;
  }

  /**
   * 启用/停用 LoRA
   */
  async setEnabled(id: string, enabled: boolean): Promise<boolean> {
    if (!db) return false;
    const result = await db
      .update(loras)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(loras.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * 创建 LoRA 记录（上传后调用）
   */
  async create(data: {
    name: string;
    description?: string;
    triggerWords: string[];
    filePath: string;
    fileSize?: number;
    fileHash?: string;
    baseModel?: string;
    scope: string[];
    previewImage?: string;
    uploadedBy?: string;
  }): Promise<string> {
    if (!db) throw new Error('DB 不可用');

    const [row] = await db.insert(loras).values({
      name: data.name,
      description: data.description,
      triggerWords: data.triggerWords,
      filePath: data.filePath,
      fileSize: data.fileSize,
      fileHash: data.fileHash,
      baseModel: data.baseModel,
      scope: data.scope,
      previewImage: data.previewImage,
      uploadedBy: data.uploadedBy,
      enabled: true,
    }).returning();

    return row.id;
  }

  /**
   * 删除 LoRA 记录（不删文件）
   */
  async delete(id: string): Promise<boolean> {
    if (!db) return false;
    const result = await db.delete(loras).where(eq(loras.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  private toLoraInfo = (row: any): LoraInfo => ({
    id: row.id,
    name: row.name,
    triggerWords: row.triggerWords ?? [],
    filePath: row.filePath,
    baseModel: row.baseModel,
  });
}

/**
 * Fallback 实现（DB 不可用）
 */
export class FallbackLoraManager implements ILoraPort {
  readonly name = 'lora-fallback';

  async loadActiveLoras(_serviceType: AIServiceType): Promise<LoraInfo[]> {
    return [];  // 无 LoRA
  }

  injectIntoWorkflow(workflowJson: unknown, _loras: LoraInfo[]): unknown {
    return workflowJson;
  }

  injectTriggers(prompt: string, _loras: LoraInfo[]): string {
    return prompt;
  }
}