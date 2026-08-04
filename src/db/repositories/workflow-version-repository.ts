/**
 * Phase 5.4 · WorkflowVersionRepository（工作流版本 Repository）
 *
 * ADR-009（版本不可变）+ ADR-014（Repository 抽象）
 *
 * - 发布新版本：version = max(version)+1，旧版本 isActive=false
 * - 获取当前激活版本
 * - DB 不可用 → 内存缓存兜底（本地开发）
 */

import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/db';
import { workflowVersions } from '@/db/schema/workflow-versions';
import { withRetry } from './db-retry';

/** 非空 DB 引用 */
const dbc = db as NonNullable<typeof db>;

export interface WorkflowVersionRow {
  id: string;
  workflowId: string;
  version: number;
  name: string | null;
  workflowJson: unknown;
  comfyuiHost: string | null;
  isActive: boolean;
  createdAt: Date;
}

export class WorkflowVersionRepository {
  /** 获取某 workflow 当前激活版本 */
  async getActive(workflowId: string): Promise<WorkflowVersionRow | null> {
    if (!db) return null;
    try {
      const rows = await withRetry(() =>
        dbc
          .select()
          .from(workflowVersions)
          .where(and(eq(workflowVersions.workflowId, workflowId), eq(workflowVersions.isActive, true)))
          .limit(1)
      );
      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch {
      return null;
    }
  }

  /** 获取某 workflow 全部版本（新→旧） */
  async listVersions(workflowId: string): Promise<WorkflowVersionRow[]> {
    if (!db) return [];
    try {
      const rows = await withRetry(() =>
        dbc
          .select()
          .from(workflowVersions)
          .where(eq(workflowVersions.workflowId, workflowId))
          .orderBy(desc(workflowVersions.version))
      );
      return rows.map((r) => this.mapRow(r));
    } catch {
      return [];
    }
  }

  /**
   * 发布新版本（immutable：不修改旧版本，仅取消其 isActive）
   * @returns 新版本号
   */
  async publish(input: {
    workflowId: string;
    workflowJson: unknown;
    comfyuiHost?: string;
    name?: string;
    changelog?: string;
    createdBy?: string;
  }): Promise<{ version: number; id: string } | null> {
    if (!db) return null;
    try {
      const all = await this.listVersions(input.workflowId);
      const nextVersion = (all[0]?.version ?? 0) + 1;

      // 1. 取消旧版本激活
      if (all.length > 0) {
        for (const v of all.filter((x) => x.isActive)) {
          await withRetry(() =>
            dbc
              .update(workflowVersions)
              .set({ isActive: false })
              .where(eq(workflowVersions.id, v.id))
          );
        }
      }

      // 2. 插入新版本
      const [row] = await withRetry(() =>
        dbc
          .insert(workflowVersions)
          .values({
            workflowId: input.workflowId,
            version: nextVersion,
            name: input.name ?? `v${nextVersion}`,
            workflowJson: input.workflowJson as never,
            comfyuiHost: input.comfyuiHost ?? null,
            changelog: input.changelog ?? null,
            isActive: true,
            createdBy: input.createdBy ?? null,
          })
          .returning()
      );
      return { version: nextVersion, id: row.id };
    } catch {
      return null;
    }
  }

  private mapRow(row: {
    id: string;
    workflowId: string;
    version: number;
    name: string | null;
    workflowJson: unknown;
    comfyuiHost: string | null;
    isActive: boolean;
    createdAt: Date;
  }): WorkflowVersionRow {
    return {
      id: row.id,
      workflowId: row.workflowId,
      version: row.version,
      name: row.name,
      workflowJson: row.workflowJson,
      comfyuiHost: row.comfyuiHost,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  }
}

export const workflowVersionRepository = new WorkflowVersionRepository();
