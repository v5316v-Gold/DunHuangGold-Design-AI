/**
 * Phase 5.3 · ApiConfigsRepository（api_configs 表访问抽象）
 *
 * 服务于 admin/api-config 路由（17 字段配置）。注意：与 providers 表（ProviderRegistry 用）不同。
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { apiConfigs } from '@/db/schema/_tables';
import { withRetry } from './db-retry';

/* eslint-disable @typescript-eslint/no-explicit-any */


const dbc = db as NonNullable<typeof db>;

export interface ApiConfigRow {
  id: string;
  name: string;
  provider: string | null;
  apiKey: string | null;
  model: string | null;
  url: string | null;
  enabled: boolean;
  description: string | null;
  appId: string | null;
  disableThoughtChain: boolean;
  enableAdvancedParams: boolean;
  filterThoughtOutput: boolean;
  translateModel: string | null;
  optimizeModel: string | null;
  vlmModel: string | null;
  showOnAssistant: boolean;
  updatedAt: Date | null;
}

export class ApiConfigsRepository {
  /** 列出所有配置 */
  async list(): Promise<ApiConfigRow[]> {
    if (!db) return [];
    try {
      const rows = await withRetry(() => dbc.select().from(apiConfigs));
      return rows.map(this.mapRow);
    } catch {
      return [];
    }
  }

  private mapRow = (r: any): ApiConfigRow => ({
    id: r.id,
    name: r.name,
    provider: r.provider,
    apiKey: r.apiKey,
    model: r.model,
    url: r.url,
    enabled: r.enabled ?? false,
    description: r.description,
    appId: r.appId,
    disableThoughtChain: r.disableThoughtChain ?? false,
    enableAdvancedParams: r.enableAdvancedParams ?? false,
    filterThoughtOutput: r.filterThoughtOutput ?? false,
    translateModel: r.translateModel,
    optimizeModel: r.optimizeModel,
    vlmModel: r.vlmModel,
    showOnAssistant: r.showOnAssistant ?? false,
    updatedAt: r.updatedAt,
  });
}

export const apiConfigsRepository = new ApiConfigsRepository();
