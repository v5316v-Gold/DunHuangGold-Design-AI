/**
 * POST /api/ai/generate-async
 *
 * 异步任务提交（返回 taskId，前端轮询/SSE）
 *
 * Phase 3.2：委托 GenerationService（统一创建/算力预扣/审计）
 * 旧版 /api/ai/generate 保留同步模式（向后兼容）
 *
 * 请求体：{ service|featureId, ...params }
 * 响应：{ success, taskId, status: 'pending', statusUrl, powerCost }
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { rateLimit, getClientIP, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { ApiErrors, API_ERROR_CODES, fail, ok } from '@/lib/api/envelope';
import { generationService } from '@/lib/ai/application/generation-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. 鉴权
  const user = await requireAuth(request);
  if (!user) return ApiErrors.authRequired('req');
  const requestId =
    request.headers.get('X-Request-Id') || `req_${crypto.randomUUID()}`;

  // 2. 限流
  const ip = getClientIP(request);
  const rl = await rateLimit(ip, WRITE_LIMIT);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    // 3. 解析参数（service / featureId 兼容）
    const body = (await request.json()) as Record<string, unknown>;
    const featureId =
      typeof body.service === 'string'
        ? body.service
        : typeof body.featureId === 'string'
          ? body.featureId
          : '';
    const { service: _service, featureId: _featureId, ...params } = body;

    // 4. 委托 GenerationService.create（校验/算力预扣/落库/入队/审计）
    const result = await generationService.create(
      user.userId,
      { featureId, params },
      { requestId, traceId: request.headers.get('x-trace-id') || requestId }
    );

    if (!result.success) {
      const code = (result.code as keyof typeof API_ERROR_CODES) ?? 'INTERNAL_ERROR';
      if (!(code in API_ERROR_CODES)) {
        return fail('INTERNAL_ERROR', result.message || '任务提交失败', {
          requestId,
          details: result.details,
        });
      }
      return fail(code, result.message || '任务提交失败', {
        requestId,
        details: result.details,
      });
    }

    // 5. 成功 → 201/200 + taskId
    return ok(
      {
        taskId: result.taskId,
        status: result.status,
        statusUrl: `/api/tasks/${result.taskId}`,
        powerCost: result.reservedPower,
        message: '任务已提交，请通过 statusUrl 查询进度',
      },
      { requestId }
    );
  } catch (error) {
    return fail('INTERNAL_ERROR', '异步任务提交失败', {
      requestId,
      details: { message: error instanceof Error ? error.message : String(error) },
    });
  }
}
