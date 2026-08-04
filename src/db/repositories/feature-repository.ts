/**
 * Phase 5.2 · FeatureRepository（功能元数据访问抽象）
 *
 * ADR-003（metadata 驱动）+ ADR-012（DB 运行时真源）+ 5.6（自动重连）
 *
 * 职责：features 表读写。DB 失败 → FEATURE_DEFINITIONS 静态兜底（仅默认值，ADR-012）。
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { features } from '@/db/schema/features';
import { FEATURE_DEFINITIONS } from '@/config/features';
import { getFeatureCost } from '@/lib/feature-costs';
import { withRetry } from './db-retry';

export interface FeatureRow {
  id: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  cost: number;
  enabled: boolean;
  defaultExecutor: string;
  fallbackExecutors: string[];
  displayGroup?: string | null;
  supportsAIAssistant?: boolean | null;
}

export class FeatureRepository {
  /** 按 id 查询（DB 失败 → 静态定义兜底） */
  async findById(featureId: string): Promise<FeatureRow | null> {
    if (db) {
      try {
        const rows = await withRetry(() =>
          (db as NonNullable<typeof db>).select().from(features).where(eq(features.id, featureId)).limit(1)
        );
        const row = rows[0];
        if (row) {
          return {
            id: row.id,
            name: row.name,
            description: row.description,
            category: row.category,
            icon: row.icon,
            cost: row.cost ?? getFeatureCost(featureId),
            enabled: row.enabled ?? true,
            defaultExecutor: row.defaultExecutor ?? 'third-party',
            fallbackExecutors: row.fallbackExecutors ?? ['comfyui', 'mock'],
            displayGroup: row.displayGroup,
            supportsAIAssistant: row.supportsAIAssistant ?? null,
          };
        }
      } catch {
        // 静态兜底
      }
    }
    const def = FEATURE_DEFINITIONS[featureId];
    return def
      ? {
          id: featureId,
          name: def.name,
          description: def.description,
          category: def.category,
          icon: def.icon,
          cost: getFeatureCost(featureId),
          enabled: true,
          defaultExecutor: 'third-party',
          fallbackExecutors: ['comfyui', 'mock'],
        }
      : null;
  }

  /** 列出所有启用功能 */
  async listEnabled(): Promise<FeatureRow[]> {
    if (db) {
      try {
        const rows = await withRetry(() =>
          (db as NonNullable<typeof db>).select().from(features).where(eq(features.enabled, true))
        );
        if (rows.length > 0) {
          return rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            category: row.category,
            icon: row.icon,
            cost: row.cost ?? getFeatureCost(row.id),
            enabled: row.enabled ?? true,
            defaultExecutor: row.defaultExecutor ?? 'third-party',
            fallbackExecutors: row.fallbackExecutors ?? ['comfyui', 'mock'],
            displayGroup: row.displayGroup,
            supportsAIAssistant: row.supportsAIAssistant ?? null,
          }));
        }
      } catch {
        // 静态兜底
      }
    }
    // 静态兜底：FEATURE_DEFINITIONS 全部视为启用（默认值）
    return Object.values(FEATURE_DEFINITIONS).map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      icon: def.icon,
      cost: getFeatureCost(def.id),
      enabled: true,
      defaultExecutor: 'third-party',
      fallbackExecutors: ['comfyui', 'mock'],
    }));
  }
}

export const featureRepository = new FeatureRepository();
