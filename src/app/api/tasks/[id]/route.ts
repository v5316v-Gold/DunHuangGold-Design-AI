/**
 * GET /api/tasks/[id]
 *
 * 查询任务状态（前端轮询用）
 *
 * 响应：
 * {
 *   id: string,
 *   status: 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter' | 'cancelled',
 *   progress: 0-100,
 *   error: string | null,
 *   output: object | null,
 *   startedAt: ISO date | null,
 *   completedAt: ISO date | null,
 *   createdAt: ISO date
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getTaskState } from '@/lib/queue/task-state';
import { unauthorized, notFound } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. 鉴权
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  // 2. 解析 taskId
  const { id: taskId } = await params;
  if (!taskId) return notFound('任务不存在');

  // 3. 查询状态
  const state = await getTaskState(taskId);
  if (!state) return notFound('任务不存在');

  // 4. 鉴权：只能看自己的任务
  if (state.userId !== user.userId) {
    return unauthorized();
  }

  return NextResponse.json({
    id: state.id,
    status: state.status,
    progress: state.progress,
    error: state.error,
    output: state.output,
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    createdAt: state.createdAt,
    type: state.type,
  });
}