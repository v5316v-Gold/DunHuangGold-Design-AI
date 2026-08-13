/**
 * Seed LLM Providers
 *
 * 数据源：system_settings 表的 jsonb value 字段（key = 'cloud_connections'）
 * 写入：MiniMax + DeepSeek 两个 LLM 连接
 *
 * 运行：pnpm tsx scripts/seed-llm-providers.ts
 */

import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

const CLOUD_CONNECTIONS_KEY = 'cloud_connections';

const SEED_LLM_CONNS: Record<string, any> = {
  'llm-minimax-main': {
    id: 'llm-minimax-main',
    name: 'MiniMax (China) - 主账号',
    provider: 'minimax',
    providerLabel: 'MiniMax (China)',
    apiKey: process.env.MINIMAX_API_KEY || '',
    endpoint: 'https://api.minimax.chat/v1',
    model: 'MiniMax-M3',
    enabled: Boolean(process.env.MINIMAX_API_KEY),
    isDefault: true,
    timeout: 60000,
    availableModels: [
      { id: 'MiniMax-M2', label: 'MiniMax-M2', enabled: false },
      { id: 'MiniMax-M2.1', label: 'MiniMax-M2.1', enabled: false },
      { id: 'MiniMax-M2.1-highspeed', label: 'MiniMax-M2.1-highspeed', enabled: false },
      { id: 'MiniMax-M2.5', label: 'MiniMax-M2.5', enabled: false },
      { id: 'MiniMax-M2.5-highspeed', label: 'MiniMax-M2.5-highspeed', enabled: false },
      { id: 'MiniMax-M2.7', label: 'MiniMax-M2.7', enabled: false },
      { id: 'MiniMax-M2.7-highspeed', label: 'MiniMax-M2.7-highspeed', enabled: true },
      { id: 'MiniMax-M3', label: 'MiniMax-M3', enabled: true },
    ],
  },
  'llm-deepseek-main': {
    id: 'llm-deepseek-main',
    name: 'DeepSeek - 主账号',
    provider: 'deepseek',
    providerLabel: 'DeepSeek',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    endpoint: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    enabled: Boolean(process.env.DEEPSEEK_API_KEY),
    isDefault: false,
    timeout: 60000,
    availableModels: [
      { id: 'deepseek-chat', label: 'deepseek-chat', enabled: true },
      { id: 'deepseek-reasoner', label: 'deepseek-reasoner', enabled: true },
      { id: 'deepseek-v4-pro', label: 'deepseek-v4-pro', enabled: false },
      { id: 'deepseek-v4-flash', label: 'deepseek-v4-flash', enabled: false },
    ],
  },
};

async function main() {
  if (!db) {
    console.error('❌ 数据库未连接');
    process.exit(1);
  }

  // 读现有 cloud_connections
  const existing = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, CLOUD_CONNECTIONS_KEY))
    .limit(1);

  let conns: Record<string, any> = {};
  if (existing.length > 0 && existing[0].value) {
    conns = (existing[0].value as Record<string, any>) || {};
  }

  // merge（不覆盖其他连接，只添加/更新 llm-*）
  for (const [id, conn] of Object.entries(SEED_LLM_CONNS)) {
    conns[id] = conn;
  }

  if (existing.length > 0) {
    await db
      .update(schema.systemSettings)
      .set({ value: conns, updatedAt: new Date() })
      .where(eq(schema.systemSettings.key, CLOUD_CONNECTIONS_KEY));
    console.log('✓ cloud_connections updated');
  } else {
    await db.insert(schema.systemSettings).values({
      key: CLOUD_CONNECTIONS_KEY,
      value: conns,
      description: '云端AI服务连接配置（含 LLM）',
    });
    console.log('✓ cloud_connections inserted');
  }

  console.log(`\n已 seed ${Object.keys(SEED_LLM_CONNS).length} 个 LLM provider：`);
  for (const [id, conn] of Object.entries(SEED_LLM_CONNS)) {
    const enabledModels = (conn.availableModels as any[]).filter((m) => m.enabled).length;
    console.log(
      `  - ${id}: provider=${conn.provider} enabled=${conn.enabled} 启用模型=${enabledModels}/${conn.availableModels.length}`
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed 失败:', err);
  process.exit(1);
});
