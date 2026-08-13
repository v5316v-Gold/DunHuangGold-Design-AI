/**
 * POST /api/admin/llm-providers/fetch-models
 *
 * 管理员调用：从指定 provider 拉取模型清单 + 自动分类
 *
 * body: {
 *   provider: 'minimax' | 'deepseek' | 'anthropic' | 'qwen' | 'openai' | 'zhipu',
 *   apiKey: string,
 *   endpoint: string
 * }
 *
 * resp: {
 *   success: true,
 *   models: [{ id, label, category, ownedBy? }],
 *   count: number,
 *   source: 'remote'
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { unauthorized, apiError } from '@/lib/api-response';
import { fetchProviderModels, type FetchedModel } from '@/lib/provider-models-fetcher';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();
  // 仅管理员可调用（联网调用第三方 API Key）
  if (user.role !== 'admin') {
    return NextResponse.json(
      { success: false, error: '仅管理员可调用' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { provider, apiKey, endpoint } = body;

    if (!provider || !apiKey || !endpoint) {
      return NextResponse.json(
        { success: false, error: '缺少 provider / apiKey / endpoint 参数' },
        { status: 400 }
      );
    }

    // 10 秒超时
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);

    const result = await fetchProviderModels({
      provider,
      apiKey,
      endpoint,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (result.error) {
      return NextResponse.json(
        { success: false, error: result.error, models: [] },
        { status: 200 } // 200 + success:false 让前端能展示具体错误
      );
    }

    return NextResponse.json({
      success: true,
      models: result.models,
      count: result.models.length,
      source: 'remote',
    });
  } catch (err) {
    return errorResponseSafe(err, '拉取模型失败');
  }
}

function errorResponseSafe(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ success: false, error: message || fallback }, { status: 500 });
}
