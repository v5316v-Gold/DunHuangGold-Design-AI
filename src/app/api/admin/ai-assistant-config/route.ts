/**
 * /api/admin/ai-assistant-config
 * 管理员 · AI 助手配置（zhipu / xflow / ollama）
 *
 * 存储：system_settings 表 key = 'ai-assistant-config'
 *   值：{ activeProvider, providers: { zhipu?, xflow?, ollama? } }
 *   （与 src/lib/ai-assistant-config.ts 的 getAIAssistantConfig() 读取兼容）
 *
 * GET  - 返回当前激活 provider 的扁平配置（前端 ApiManagerModal 读取 provider 分支字段）
 * POST - 保存某个 provider 的配置（合并已有字段，不丢高级设置）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { systemSettings } from '@/db/schema/_tables';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

const CONFIG_KEY = 'ai-assistant-config';

const PROVIDER_DEFAULTS: Record<string, Record<string, unknown>> = {
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    translateModel: 'glm-4-flash',
    optimizeModel: 'glm-4-flash',
    disableThoughtChain: false,
    enableAdvancedParams: false,
    filterThoughtOutput: false,
    enabled: false,
  },
  xflow: {
    baseUrl: 'https://api.xflow.cc/v1',
    llmModel: 'gemini-3-flash-preview-nothinking',
    vlmModel: 'grok-4-1-fast-non-reasoning',
    closeThoughtChain: true,
    filterThoughtOutput: true,
    enabled: false,
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    translateModel: 'glm-4.7-flash:latest',
    optimizeModel: 'glm-4.7-flash:latest',
    vlmModel: 'qwen3-vl:30b',
    enabled: false,
  },
};

type StoredConfig = {
  activeProvider?: string;
  providers?: Record<string, Record<string, unknown>>;
};

async function readStored(): Promise<StoredConfig | null> {
  if (!db) return null;
  try {
    const dbc = db as NonNullable<typeof db>;
    const rows = await dbc
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, CONFIG_KEY))
      .limit(1);
    if (rows.length === 0 || !rows[0].value) return null;
    const parsed =
      typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
    return parsed as StoredConfig;
  } catch {
    return null;
  }
}

async function writeStored(config: StoredConfig): Promise<boolean> {
  if (!db) return false;
  try {
    const dbc = db as NonNullable<typeof db>;
    await dbc
      .insert(systemSettings)
      .values({ key: CONFIG_KEY, value: JSON.stringify(config) })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: JSON.stringify(config), updatedAt: new Date() },
      });
    return true;
  } catch {
    return false;
  }
}

function pickProvider(provider: string, stored: StoredConfig): Record<string, unknown> {
  const existing = stored.providers?.[provider] ?? {};
  return { ...PROVIDER_DEFAULTS[provider], ...existing };
}

// ==================== GET ====================

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  const stored = await readStored();
  const providers = stored?.providers ?? {};
  const provider = stored?.activeProvider || Object.keys(providers)[0] || 'zhipu';
  const cfg = pickProvider(provider, stored ?? { providers: {} });

  // 扁平化输出：provider 分支字段 + 顶层 model（兼容 getAIAssistantConfig）
  const model =
    (cfg.translateModel as string) || (cfg.llmModel as string) || (cfg.model as string) || '';
  return NextResponse.json({
    requestId: reqId(),
    success: true,
    data: {
      provider,
      apiKey: (cfg.apiKey as string) ?? '',
      baseUrl: (cfg.baseUrl as string) ?? '',
      model,
      ...cfg,
    },
  });
}

// ==================== POST（保存 provider 配置） ====================

interface SaveInput {
  provider?: string;
  apiKey?: string;
  model?: string;
  optimizeModel?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  let body: SaveInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const provider = body.provider || 'zhipu';
  if (!PROVIDER_DEFAULTS[provider]) {
    return NextResponse.json({ requestId: reqId(), success: false, error: `不支持的 provider: ${provider}` }, { status: 400 });
  }

  const stored = (await readStored()) ?? { activeProvider: 'zhipu', providers: {} };
  const providers = stored.providers ?? {};
  const prev = pickProvider(provider, stored);
  const next: Record<string, unknown> = { ...prev };

  // apiKey：仅当非空时更新（避免前端空串覆盖已保存的 key）
  if (body.apiKey !== undefined && body.apiKey !== '') next.apiKey = body.apiKey;
  if (body.baseUrl !== undefined && body.baseUrl !== '') next.baseUrl = body.baseUrl;
  if (body.enabled !== undefined) next.enabled = body.enabled;
  else if (next.enabled === undefined) next.enabled = true;

  // 按 provider 落 model 字段
  if (provider === 'xflow') {
    if (body.model) next.llmModel = body.model;
    if (body.optimizeModel) next.optimizeModel = body.optimizeModel;
  } else {
    // zhipu / ollama：model → translateModel
    if (body.model) next.translateModel = body.model;
    if (body.optimizeModel) next.optimizeModel = body.optimizeModel;
  }
  // 顶层 model（兼容 getAIAssistantConfig）
  if (body.model) next.model = body.model;

  providers[provider] = next;
  const ok = await writeStored({ activeProvider: provider, providers });
  if (!ok) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '保存失败（数据库不可用）' }, { status: 503 });
  }

  return NextResponse.json({
    requestId: reqId(),
    success: true,
    data: { provider, saved: true },
  });
}
