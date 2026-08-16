/**
 * scripts/seed-api-configs.ts
 *
 * W1 · 把 5 大类别 API 配置从 .env 自动落库(api_configs 表 0 行修补)。
 *
 * 用法:
 *   DATABASE_URL=... API_KEY_ENCRYPTION_KEY=<64hex> pnpm tsx scripts/seed-api-configs.ts
 *
 * 行为:
 *   - 读 .env / process.env,按 ENV_DEFS 5 大类提取 ① apiKey ② provider ③ model
 *   - 已存在 apiConfigs.id 的 update;缺则 insert(默认 enabled=true 且 key 已注入)
 *   - 把 apiKey AES-256-GCM 加密到 api_config_secrets;apiConfigs.apiKey 仅保留 placeholder(避免回显明文)
 *   - 共用端点(MINIMAX/IMAGE_API_KEY)按类别优先级复用到多个 config
 *   - 退出码 0=成功,1=密钥未注入或环境缺失
 */
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { apiConfigs, apiConfigSecrets } from '@/db/schema/_tables';
import { encryptSecret, hasEncryptionKey, maskApiKey } from '@/lib/secret-vault';

interface EnvDef {
  id: string;
  name: string;
  category: 'llm' | 'image-generate' | 'image-edit' | '3d-modeling' | 'video-generate';
  providerDefault: string;
  providerEnv?: string;
  modelDefault: string;
  modelEnv?: string;
  urlEnv?: string;
  keyPriority: string[];
  /** 哪个特征把该 key 共享过去 */
  shared?: boolean;
  timeout?: number;
  description: string;
}

const ENV_DEFS: EnvDef[] = [
  {
    id: 'llm-chat',
    name: 'LLM 对话',
    category: 'llm',
    providerDefault: 'zhipu',
    modelDefault: 'glm-4-7-251222',
    keyPriority: ['ZHIPU_API_KEY', 'QWEN_API_KEY', 'OPENAI_API_KEY', 'LLM_API_KEY'],
    description: '大语言模型对话（多轮流式输出）',
    timeout: 120000,
  },
  {
    id: 'image-generate',
    name: '图片生成',
    category: 'image-generate',
    providerDefault: 'minimax',
    modelDefault: 'image-01',
    keyPriority: ['MINIMAX_API_KEY', 'IMAGE_API_KEY', 'ZHIPU_API_KEY', 'OPENAI_API_KEY'],
    shared: true,
    description: '文生图 / 图生图 / 风格转换',
    timeout: 90000,
  },
  {
    id: 'image-edit',
    name: '图片编辑',
    category: 'image-edit',
    providerDefault: 'zhipu',
    modelDefault: 'cogview-3',
    keyPriority: ['ZHIPU_API_KEY', 'MINIMAX_API_KEY', 'IMAGE_API_KEY', 'OPENAI_API_KEY'],
    shared: true,
    description: '移除背景 / 高清放大 / 去水印',
    timeout: 60000,
  },
  {
    id: '3d-modeling',
    name: '3D 建模',
    category: '3d-modeling',
    providerDefault: 'meshy',
    modelDefault: 'meshy-v3',
    keyPriority: ['MESHY_API_KEY', 'MINIMAX_API_KEY', 'ZHIPU_API_KEY'],
    description: '图转浮雕 / 图转 3D 模型 / 图像立体化',
    timeout: 120000,
  },
  {
    id: 'video-generate',
    name: '视频生成',
    category: 'video-generate',
    providerDefault: 'minimax',
    modelDefault: 'video-01',
    keyPriority: ['MINIMAX_API_KEY', 'VIDEO_API_KEY', 'ZHIPU_API_KEY'],
    description: '文生视频 / 图生视频',
    timeout: 180000,
  },
];

function resolveEnv(name: string): string | null {
  const v = process.env[name];
  if (v && !v.startsWith('your-') && v.trim().length > 0) return v.trim();
  return null;
}

function pickKey(env: EnvDef): string | null {
  for (const k of env.keyPriority) {
    const v = resolveEnv(k);
    if (v) return v;
  }
  return null;
}

function providerFor(env: EnvDef): string {
  if (env.providerEnv) {
    const v = resolveEnv(env.providerEnv);
    if (v) return v;
  }
  return env.providerDefault;
}

function modelFor(env: EnvDef): string {
  if (env.modelEnv) {
    const v = resolveEnv(env.modelEnv);
    if (v) return v;
  }
  return env.modelDefault;
}

async function upsertConfig(env: EnvDef, apiKey: string | null) {
  const provider = providerFor(env);
  const model = modelFor(env);
  const enabled = !!apiKey;
  const placeholderKey = apiKey ? maskApiKey(apiKey) : '';

  if (!db) throw new Error('DB not initialized');

  // 1) upsert apiConfigs(apiKey 字段保持 masked / 空)
  await db
    .insert(apiConfigs)
    .values({
      id: env.id,
      name: env.name,
      apiKey: placeholderKey,
      provider,
      model,
      enabled,
      timeout: env.timeout ?? 60000,
      description: env.description,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: apiConfigs.id,
      set: {
        name: env.name,
        provider,
        model,
        enabled,
        timeout: env.timeout ?? 60000,
        description: env.description,
        updatedAt: new Date(),
        // 注意:不覆盖 apiKey;由 api_config_secrets 管理
      },
    });

  // 2) 写入加密密文
  if (apiKey) {
    const enc = encryptSecret(apiKey);
    await db
      .insert(apiConfigSecrets)
      .values({
        configId: env.id,
        ciphertext: enc.ciphertext,
        iv: enc.iv,
        authTag: enc.authTag,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: apiConfigSecrets.configId,
        set: {
          ciphertext: enc.ciphertext,
          iv: enc.iv,
          authTag: enc.authTag,
          updatedAt: new Date(),
        },
      });
  } else {
    // 清掉密文,避免脏数据
    await db.execute(sql`DELETE FROM api_config_secrets WHERE config_id = ${env.id}`);
  }

  return { id: env.id, provider, model, enabled, maskedKey: placeholderKey };
}

async function main() {
  if (!hasEncryptionKey()) {
    console.error('[seed-api-configs] ✘ API_KEY_ENCRYPTION_KEY 缺失或非 64 hex。请生成: openssl rand -hex 32');
    process.exit(1);
  }
  if (!db) {
    console.error('[seed-api-configs] ✘ DATABASE_URL 未配置或数据库连接失败');
    process.exit(1);
  }

  console.log('[seed-api-configs] 开始注入 5 大类别 API 配置…\n');
  const summary: Array<{ id: string; provider: string; model: string; enabled: boolean; maskedKey: string }> = [];

  for (const def of ENV_DEFS) {
    const k = pickKey(def);
    const r = await upsertConfig(def, k);
    summary.push(r);
    console.log(`  • ${def.id.padEnd(16)} ${r.provider.padEnd(10)} ${r.model.padEnd(20)} enabled=${r.enabled}  key=${r.maskedKey}`);
  }

  console.log('\n[seed-api-configs] 完成 ✓');
  console.log('[seed-api-configs] 说明:apiKey 已通过 AES-256-GCM 加密存到 api_config_secrets,apiConfigs.apiKey 仅保留 masked,前端不会回显明文。');
  console.log('[seed-api-configs] 提示:缺密钥的类别仍可工作,会按 fallback 链路降级到本地 ComfyUI 或 mock。');
  process.exit(0);
}

main().catch((e) => {
  console.error('[seed-api-configs] ✘', e instanceof Error ? e.message : e);
  process.exit(1);
});
