/**
 * POST /api/ai/generate
 *
 * 同步生成（向后兼容，旧端点）
 * Phase 3.2：委托 GenerationService.executeSync（内部走 orchestrator）
 *
 * 请求体：{ service|featureId, ...params }
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { rateLimit, getClientIP, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { ApiErrors, fail, ok } from '@/lib/api/envelope';
import { generationService } from '@/lib/ai/application/generation-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return ApiErrors.authRequired('req');
  const requestId =
    request.headers.get('X-Request-Id') || `req_${crypto.randomUUID()}`;

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
    const { service: _service, featureId: _featureId, ...params } = body;

    if (!featureId) {
      return fail('INVALID_INPUT', '缺少 service 参数', { requestId });
    }

    const result = await generationService.executeSync(
      user.userId,
      { featureId, params },
      { requestId, traceId: request.headers.get('x-trace-id') || requestId }
    );

    if (!result.success) {
      const code = (result.error?.code as string) ?? 'INTERNAL_ERROR';
      const statusMap: Record<string, number> = {
        FEATURE_NOT_FOUND: 404,
        FEATURE_DISABLED: 422,
        INSUFFICIENT_POWER: 422,
        PROVIDER_UNAVAILABLE: 503,
        INVALID_INPUT: 400,
      };
      return fail(
        code === 'ALL_EXECUTORS_FAILED' ? 'PROVIDER_UNAVAILABLE' : (code as never),
        result.error?.message || 'AI 生成失败',
        { requestId, statusOverride: statusMap[code] }
      );
    }

    return ok(result.result, {
      requestId,
      meta: { traceId: result.traceId },
    });
  } catch (error) {
    return fail('INTERNAL_ERROR', 'AI 生成失败', {
      requestId,
      details: { message: error instanceof Error ? error.message : String(error) },
    });
  }
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return ApiErrors.authRequired('req');
  const requestId =
    request.headers.get('X-Request-Id') || `req_${crypto.randomUUID()}`;
  const { FEATURE_DEFINITIONS } = await import('@/config/features');
  return ok({ features: Object.keys(FEATURE_DEFINITIONS) }, { requestId });
}
