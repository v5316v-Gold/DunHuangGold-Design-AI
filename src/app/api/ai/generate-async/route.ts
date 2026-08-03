/**
 * POST /api/ai/generate-async
 *
 * 异步任务提交（返回 taskId，前端轮询/SSE）
 *
 * 旧版 /api/ai/generate 保留同步模式（向后兼容）
 * 客户端逐步切换到 /api/ai/generate-async
 *
 * 请求体：同 /api/ai/generate（service + params）
 * 响应：{ taskId, status: 'pending', statusUrl, duplicate?: true }
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '@/lib/auth';
import { rateLimit, getClientIP, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { badRequest, unauthorized, internalError } from '@/lib/api-response';
import { db } from '@/storage/database/db';
import { tasks } from '@/storage/database/shared/schema';
import { enqueueTask, type TaskPayload } from '@/lib/queue/task-queue';
import { getFeatureCost } from '@/lib/api-config';
import { checkUserPower } from '@/lib/ai-service/power-helper';
import type { AIServiceType } from '@/lib/ai-service/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 生成幂等键：基于用户 + 服务 + 参数 hash
 */
function generateIdempotencyKey(
  userId: string,
  service: string,
  params: Record<string, unknown>
): string {
  const sorted = JSON.stringify(params, Object.keys(params).sort());
  return crypto
    .createHash('sha256')
    .update(`${userId}:${service}:${sorted}`)
    .digest('hex')
    .substring(0, 16);
}

function isValidServiceType(value: unknown): value is AIServiceType {
  if (typeof value !== 'string') return false;
  const valid: AIServiceType[] = [
    'text2img', 'refine', 'relief', 'image3d', 'stereo',
    'removebg', 'upscale', 'watermark', 'sketch', 'blend',
    'oneclick', 'multiview', 'free', 'text2video', 'img2video',
    'dialogue', 'ai-assistant',
  ];
  return valid.includes(value as AIServiceType);
}

export async function POST(request: NextRequest) {
  // 1. 鉴权
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  // 2. 限流
  const ip = getClientIP(request);
  const rl = await rateLimit(ip, WRITE_LIMIT);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    if (!db) {
      return NextResponse.json(
        { success: false, error: '数据库不可用' },
        { status: 503 }
      );
    }

    // 3. 解析参数
    const body = await request.json();
    const { service, ...params } = body;

    if (!service) return badRequest('缺少 service 参数');
    if (!isValidServiceType(service)) {
      return badRequest(`不支持的服务类型: ${service}`);
    }

    // 4. 算力检查（前置）
    const cost = getFeatureCost(service);
    const hasPower = await checkUserPower(user.userId, cost);
    if (!hasPower) {
      return NextResponse.json(
        { success: false, error: '算力不足', required: cost },
        { status: 402 }
      );
    }

    // 5. 生成幂等键
    const idempotencyKey = generateIdempotencyKey(user.userId, service, params);

    // 6. 创建任务记录（tasks 表）
    const [task] = await db.insert(tasks).values({
      userId: user.userId,
      type: service,
      status: 'pending',
      input: params,
      powerCost: cost,
    }).returning();

    if (!task) {
      return internalError(new Error('任务创建失败'), '创建任务失败');
    }

    // 7. 入队（业务层幂等检查在 enqueueTask 内）
    const payload: TaskPayload = {
      taskId: task.id,
      userId: user.userId,
      serviceType: service,
      params,
      idempotencyKey,
    };
    const result = await enqueueTask(payload);

    if (result.duplicate) {
      // 幂等键重复（理论上已创建 tasks 但重复提交）
      // 返回 429 让前端提示用户
      return NextResponse.json(
        { success: false, error: '任务提交过于频繁，请稍后重试' },
        { status: 429 }
      );
    }

    // 8. 立即返回（不等待结果）
    return NextResponse.json({
      success: true,
      taskId: task.id,
      status: 'pending',
      statusUrl: `/api/tasks/${task.id}`,
      powerCost: cost,
      message: '任务已提交，请通过 statusUrl 查询进度',
    });

  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { success: false, error: '参数验证失败', details: (error as any).errors },
        { status: 400 }
      );
    }
    return internalError(error, '异步任务提交失败');
  }
}