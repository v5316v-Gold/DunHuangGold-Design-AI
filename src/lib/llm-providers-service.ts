/**
 * LLM Providers Service
 *
 * 数据源：system_settings 表的 jsonb value 字段（key = 'cloud_connections'）
 * 筛选条件：id 以 'llm-' 开头 且 enabled = true
 *
 * 输出结构（与 /api/models 兼容）：
 * {
 *   providers: [{ id, label, available, count, models: [{id, label, available}] }],
 *   default: string
 * }
 */

import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

/* eslint-disable @typescript-eslint/no-explicit-any */


const CLOUD_CONNECTIONS_KEY = 'cloud_connections';

export interface LLMModelItem {
  id: string;
  label: string;
  available: boolean;
}

export interface LLMProvider {
  id: string;
  label: string;
  available: boolean;
  count: number;
  models: LLMModelItem[];
}

export interface LLMProvidersResponse {
  success: true;
  providers: LLMProvider[];
  default: string;
}

/** 读取所有启用的 LLM 连接（id 以 llm- 开头） */
export async function listEnabledLLMProviders(): Promise<LLMProvidersResponse> {
  // 默认降级值（DB 不可用时）
  const fallback: LLMProvidersResponse = {
    success: true,
    providers: [
      {
        id: 'minimax',
        label: 'MiniMax (China)',
        available: Boolean(process.env.MINIMAX_API_KEY),
        count: 1,
        models: [{ id: 'MiniMax-M3', label: 'MiniMax-M3', available: true }],
      },
    ],
    default: 'MiniMax-M3',
  };

  try {
    if (!db) return fallback;

    // 读 system_settings.cloud_connections
    const result = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, CLOUD_CONNECTIONS_KEY))
      .limit(1);

    let connections: Record<string, any> = {};
    if (result && result.length > 0 && result[0].value) {
      connections = result[0].value as Record<string, any>;
    }

    // 筛选 LLM 连接
    const llmConns = Object.values(connections).filter(
      (c: any) => c?.id?.startsWith?.('llm-') && c?.enabled === true
    );

    // 按 provider 分组
    const providerMap = new Map<string, LLMProvider>();
    for (const conn of llmConns as any[]) {
      if (!conn.provider) continue;
      const pid = conn.provider;
      if (!providerMap.has(pid)) {
        providerMap.set(pid, {
          id: pid,
          label: conn.providerLabel || pid,
          available: Boolean(conn.apiKey),
          count: 0,
          models: [],
        });
      }
      const p = providerMap.get(pid)!;
      const models = Array.isArray(conn.availableModels) ? conn.availableModels : [];
      for (const m of models) {
        if (m && m.enabled) {
          p.models.push({
            id: m.id,
            label: m.label || m.id,
            available: true,
          });
        }
      }
      p.count = p.models.length;
    }

    const providers = Array.from(providerMap.values());

    // 默认模型：第一个 provider 的第一个 model
    const defaultModel = providers[0]?.models[0]?.id || 'MiniMax-M3';

    return {
      success: true,
      providers,
      default: defaultModel,
    };
  } catch (err) {
    console.error('[llm-providers-service] 读取失败，使用降级值:', err);
    return fallback;
  }
}
