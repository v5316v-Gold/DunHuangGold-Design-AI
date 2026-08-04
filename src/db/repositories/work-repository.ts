/**
 * Phase 5.2 · WorkRepository（作品数据访问抽象）
 *
 * ADR-014（Repository 抽象）+ 5.6（自动重连）
 *
 * 职责：works 表统一读写（作品保存/列表查询）。
 */

import { eq, desc, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { works } from '@/db/schema/_tables';
import { withRetry } from './db-retry';

export interface WorkRow {
  id: string;
  userId: string;
  type: string;
  title: string | null;
  prompt: string | null;
  outputImageUrl: string | null;
  outputVideoUrl: string | null;
  createdAt: Date;
}

export class WorkRepository {
  /** 保存作品 */
  async create(input: {
    userId: string;
    type: string;
    title?: string | null;
    outputImageUrl?: string | null;
    outputVideoUrl?: string | null;
    prompt?: string | null;
    params?: Record<string, unknown>;
    powerCost?: number;
  }): Promise<string | null> {
    if (!db) return null;
    const dbc = db as NonNullable<typeof db>;
    try {
      const [row] = await withRetry(() =>
        dbc
          .insert(works)
          .values({
            userId: input.userId,
            type: input.type,
            title: input.title ?? null,
            outputImageUrl: input.outputImageUrl ?? null,
            outputVideoUrl: input.outputVideoUrl ?? null,
            prompt: input.prompt ?? null,
            params: input.params ?? {},
            powerCost: input.powerCost ?? 0,
          })
          .returning()
      );
      return row?.id ?? null;
    } catch {
      return null;
    }
  }

  /** 用户作品列表（按时间倒序） */
  async listByUser(
    userId: string,
    opts: { type?: string; limit?: number; offset?: number } = {}
  ): Promise<WorkRow[]> {
    if (!db) return [];
    const dbc = db as NonNullable<typeof db>;
    try {
      const limit = opts.limit ?? 20;
      const offset = opts.offset ?? 0;
      const conditions: SQL[] = [eq(works.userId, userId)];
      if (opts.type) {
        conditions.push(eq(works.type, opts.type));
      }
      const rows = await withRetry(() =>
        dbc
          .select()
          .from(works)
          .where(conditions.length === 1 ? conditions[0] : (undefined as never))
          .orderBy(desc(works.createdAt))
          .limit(limit)
          .offset(offset)
      );
      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        type: row.type,
        title: row.title,
        prompt: row.prompt,
        outputImageUrl: row.outputImageUrl,
        outputVideoUrl: row.outputVideoUrl,
        createdAt: row.createdAt,
      }));
    } catch {
      return [];
    }
  }
}

export const workRepository = new WorkRepository();
