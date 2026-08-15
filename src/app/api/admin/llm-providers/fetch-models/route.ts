/**
 * /api/admin/llm-providers/fetch-models
 * 管理员 · 从 provider 拉取模型清单（ModelsEditor「一键获取模型」）
 *
 * POST /api/admin/llm-providers/fetch-models
 *   Body: { provider, apiKey, endpoint }
 *   Resp: { success, models: [{ id, label, category? }] } 或 { success: false, error }
 *
 * 复用 src/lib/provider-models-fetcher.ts 的 fetchProviderModels（15s 超时，容错返回空 + error）。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchProviderModels } from '@/lib/provider-models-fetcher';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

const FETCH_TIMEOUT_MS = 15000;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  let body: { provider?: string; apiKey?: string; endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const provider = body.provider || '';
  const apiKey = body.apiKey || '';
  const endpoint = body.endpoint || '';
  if (!provider || !apiKey || !endpoint) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: '缺少 provider / apiKey / endpoint',
    }, { status: 400 });
  }

  const result = await fetchProviderModels({
    provider: provider as 'minimax' | 'deepseek' | 'anthropic' | 'qwen' | 'openai' | 'zhipu',
    apiKey,
    endpoint,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (result.error) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: result.error,
    });
  }

  return NextResponse.json({
    requestId: reqId(),
    success: true,
    models: result.models.map((m) => ({
      id: m.id,
      label: m.label || m.id,
      category: m.category,
    })),
  });
}
