/**
 * Phase 5.2 · WorkflowRegistry
 *
 * 单一职责：按功能 ID 返回 ComfyUI 工作流配置
 * 优先级：DB features.workflow_id > TS config 兜底
 *
 * 缓存：内存 LRU（避免每次执行都查 DB）
 * 失效：DB 写入时通过 invalidate(featureId) 主动失效
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { features } from '@/db/schema/features';
import { workflowConfigs, type WorkflowConfig } from '@/config/comfyui-workflows';

/* eslint-disable @typescript-eslint/no-explicit-any */


/** 缓存 entry */
interface CacheEntry {
  config: WorkflowConfig | null;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟
const cache = new Map<string, CacheEntry>();

export class WorkflowRegistry {
  /**
   * 获取工作流配置
   * 优先级：DB 版本 > TS 兜底
   */
  async getWorkflowConfig(featureId: string): Promise<WorkflowConfig | null> {
    const cached = cache.get(featureId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.config;
    }

    const config = await this.fetchFromDb(featureId);
    cache.set(featureId, { config, fetchedAt: Date.now() });
    return config;
  }

  /** 同步版（先查缓存，未命中则降级到 TS 静态） */
  getWorkflowConfigSync(featureId: string): WorkflowConfig | null {
    const cached = cache.get(featureId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.config;
    }
    // fallback 静态兜底
    return workflowConfigs[featureId] || null;
  }

  /** 失效缓存 */
  invalidate(featureId?: string): void {
    if (featureId) {
      cache.delete(featureId);
    } else {
      cache.clear();
    }
  }

  /** 预热（启动时一次） */
  async warmup(featureIds: string[]): Promise<void> {
    await Promise.all(featureIds.map((id) => this.getWorkflowConfig(id)));
  }

  /** 列出所有已配置工作流 */
  listConfigured(): string[] {
    return Object.keys(workflowConfigs).filter(
      (id) => workflowConfigs[id]?.workflowId && workflowConfigs[id]!.workflowId !== ''
    );
  }

  private async fetchFromDb(featureId: string): Promise<WorkflowConfig | null> {
    if (!db) return workflowConfigs[featureId] || null;
    try {
      const rows = await db
        .select({
          workflowId: features.workflowId,
          defaultParams: features.defaultParams,
        })
        .from(features)
        .where(eq(features.id, featureId))
        .limit(1);
      const row = rows[0];
      if (!row) return workflowConfigs[featureId] || null;

      // DB 没存 nodeMapping（结构复杂），但 workflowId 和 defaultParams 可直接用
      const tsConfig = workflowConfigs[featureId];
      if (!row.workflowId || row.workflowId === '') {
        return tsConfig || null;
      }
      // DB 提供 workflowId + defaultParams，TS 提供 nodeMapping
      return {
        ...tsConfig,
        workflowId: row.workflowId,
        defaultParams: {
          ...tsConfig?.defaultParams,
          ...(row.defaultParams as any),
        },
      };
    } catch {
      return workflowConfigs[featureId] || null;
    }
  }
}

export const workflowRegistry = new WorkflowRegistry();
