/**
 * ApiKeyResolver
 *
 * 在后端 server-side 解析某 api_config 的明文 key,优先从加密备份解出,
 * 退到 .env,再退到 hash 当占位（永远不回显到前端）。
 */
import { db } from '@/db';
import { apiConfigs, apiConfigSecrets } from '@/db/schema/_tables';
import { eq } from 'drizzle-orm';
import { decryptSecret } from '@/lib/secret-vault';

export interface ResolvedConfig {
  id: string;
  name: string;
  provider: string;
  model: string | null;
  url: string | null;
  enabled: boolean;
  apiKey: string | null; // 仅 server-side 使用,绝不返回给前端
  timeout: number;
  source: 'secret' | 'env' | 'missing';
}

const ENV_FALLBACK: Record<string, string[]> = {
  'llm-chat': ['ZHIPU_API_KEY', 'QWEN_API_KEY', 'OPENAI_API_KEY', 'LLM_API_KEY'],
  'image-generate': ['MINIMAX_API_KEY', 'IMAGE_API_KEY', 'ZHIPU_API_KEY'],
  'image-edit': ['MINIMAX_API_KEY', 'ZHIPU_API_KEY', 'IMAGE_API_KEY'],
  '3d-modeling': ['MESHY_API_KEY', 'MINIMAX_API_KEY'],
  'video-generate': ['MINIMAX_API_KEY', 'VIDEO_API_KEY', 'ZHIPU_API_KEY'],
};

function pickEnvKey(configId: string): string | null {
  const list = ENV_FALLBACK[configId] || [];
  for (const k of list) {
    const v = process.env[k];
    if (v && !v.startsWith('your-') && v.trim().length > 0) return v.trim();
  }
  return null;
}

export async function resolveApiConfig(configId: string): Promise<ResolvedConfig | null> {
  // 1) 数据库行
  let row: { id: string; name: string; provider: string | null; model: string | null; url: string | null; enabled: boolean; apiKey: string | null; timeout: number } | null = null;
  if (db) {
    const [r] = await db
      .select({
        id: apiConfigs.id,
        name: apiConfigs.name,
        provider: apiConfigs.provider,
        model: apiConfigs.model,
        url: apiConfigs.url,
        enabled: apiConfigs.enabled,
        apiKey: apiConfigs.apiKey,
        timeout: apiConfigs.timeout,
      })
      .from(apiConfigs)
      .where(eq(apiConfigs.id, configId))
      .limit(1);
    row = r ?? null;
  }

  let apiKey: string | null = null;
  let source: ResolvedConfig['source'] = 'missing';

  // a) 优先:api_config_secrets 解密
  if (db) {
    const [sec] = await db
      .select()
      .from(apiConfigSecrets)
      .where(eq(apiConfigSecrets.configId, configId))
      .limit(1);
    if (sec) {
      try {
        apiKey = decryptSecret({
          ciphertext: sec.ciphertext,
          iv: sec.iv,
          authTag: sec.authTag,
        });
        source = 'secret';
      } catch {
        apiKey = null;
      }
    }
  }

  // b) 退到 env
  if (!apiKey) {
    const envKey = pickEnvKey(configId);
    if (envKey) {
      apiKey = envKey;
      source = 'env';
    }
  }

  // c) row 有但没有秘密位:仅当 row 字段看起来不是掩码
  if (!apiKey && row?.apiKey && !row.apiKey.includes('*') && !row.apiKey.startsWith('your-')) {
    apiKey = row.apiKey;
    source = 'env';
  }

  if (!row) {
    if (!apiKey) return null;
    return {
      id: configId,
      name: configId,
      provider: 'custom',
      model: null,
      url: null,
      enabled: true,
      apiKey,
      timeout: 60000,
      source,
    };
  }

  return {
    id: row.id,
    name: row.name,
    provider: row.provider ?? 'custom',
    model: row.model,
    url: row.url,
    enabled: !!row.enabled,
    apiKey,
    timeout: row.timeout ?? 60000,
    source,
  };
}
