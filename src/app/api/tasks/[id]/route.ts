/**
 * GET /api/tasks/[id]
 *
 * 查询任务状态（前端轮询用）
 * Phase 3.2：委托 GenerationService.query（含归属校验）
 *
 * 响应：
 * {
 *   id, status, progress, error, output, type, powerCost,
 *   startedAt, completedAt, createdAt
 * }
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { ApiErrors, fail, ok } from '@/lib/api/envelope';
import { generationService } from '@/lib/ai/application/generation-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. 鉴权
  const user = await requireAuth(request);
  if (!user) return ApiErrors.authRequired('req');
  const requestId =
    request.headers.get('X-Request-Id') || `req_${crypto.randomUUID()}`;

  // 2. 解析 taskId
  const { id: taskId } = await params;
  if (!taskId) return fail('INVALID_INPUT', '缺少任务 ID', { requestId });

  // 3. 委托 GenerationService.query（归属校验在服务内）
  const result = await generationService.query(user.userId, taskId, { requestId });

  if (!result.found) {
    return fail('TASK_NOT_FOUND', '任务不存在', { requestId });
  }
  if (!result.owned) {
    return fail('PERMISSION_DENIED', '无权查看他人任务', { requestId });
  }

  return ok(result.task, { requestId });
}
