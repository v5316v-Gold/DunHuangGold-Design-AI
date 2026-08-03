import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { rateLimit, getClientIP, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { orchestrator } from '@/lib/orchestrator/feature-orchestrator';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user)
    return NextResponse.json(
      { success: false, data: null, error: { code: 'UNAUTHORIZED', message: '未登录' }, meta: {} },
      { status: 401 }
    );
  const rl = await rateLimit(getClientIP(request), WRITE_LIMIT);
  if (!rl.success) return rateLimitResponse(rl);
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const featureId =
      typeof body.service === 'string'
        ? body.service
        : typeof body.featureId === 'string'
          ? body.featureId
          : '';
    if (!featureId)
      return NextResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'INVALID_INPUT', message: '缺少 service 参数' },
          meta: {},
        },
        { status: 400 }
      );
    const result = await orchestrator.execute({
      featureId,
      userId: user.userId,
      inputs: body,
      traceId: request.headers.get('x-request-id') || crypto.randomUUID(),
    });
    return NextResponse.json(
      {
        success: result.success,
        data: result.success ? result : null,
        error: result.success ? null : result.error,
        meta: { traceId: result.traceId, executor: result.executorUsed },
      },
      { status: result.success ? 200 : 502 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'AI 生成失败',
        },
        meta: {},
      },
      { status: 500 }
    );
  }
}
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user)
    return NextResponse.json(
      { success: false, data: null, error: { code: 'UNAUTHORIZED', message: '未登录' }, meta: {} },
      { status: 401 }
    );
  return NextResponse.json({
    success: true,
    data: { features: Object.keys((await import('@/config/features')).FEATURE_DEFINITIONS) },
    error: null,
    meta: {},
  });
}
