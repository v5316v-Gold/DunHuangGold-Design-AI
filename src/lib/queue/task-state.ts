/**
 * 任务状态机
 *
 * 状态流转：
 *   pending → processing → completed
 *                ↓
 *             failed → retrying → processing
 *                ↓
 *            dead_letter
 *            cancelled（用户主动取消）
 *
 * 所有状态变更必须通过此模块，保证一致性
 */

import { db } from '@/storage/database/db';
import { tasks } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('task-state');

// ============================================================
// 状态定义（discriminated union + exhaustiveness）
// ============================================================

export type TaskStatusKind =
  | 'pending'      // 已入队，等待 Worker
  | 'processing'   // Worker 正在处理
  | 'completed'    // 成功完成
  | 'failed'       // 失败（可重试）
  | 'dead_letter'  // 重试 3 次仍失败
  | 'cancelled';   // 用户取消

export interface TaskStatusUpdate {
  status: TaskStatusKind;
  progress?: number;
  error?: string;
  output?: Record<string, unknown>;
  attempt?: number;
}

// ============================================================
// 状态变更函数
// ============================================================

/**
 * 标记任务开始处理
 */
export async function markProcessing(
  taskId: string,
  attempt: number
): Promise<void> {
  await updateTaskState(taskId, {
    status: 'processing',
    progress: 0,
    attempt,
  });
  logger.info(`任务开始处理: ${taskId} (attempt ${attempt})`);
}

/**
 * 更新任务进度（0-100）
 */
export async function updateProgress(
  taskId: string,
  progress: number,
  _message?: string
): Promise<void> {
  if (!db) return;
  await db.update(tasks)
    .set({ progress: Math.min(100, Math.max(0, progress)) })
    .where(eq(tasks.id, taskId));
}

/**
 * 标记任务完成
 */
export async function markCompleted(
  taskId: string,
  output: Record<string, unknown>
): Promise<void> {
  await updateTaskState(taskId, {
    status: 'completed',
    progress: 100,
    output,
  });
  logger.info(`任务完成: ${taskId}`);
}

/**
 * 标记任务失败（可重试）
 */
export async function markFailed(
  taskId: string,
  error: string,
  attempt: number
): Promise<void> {
  await updateTaskState(taskId, {
    status: 'failed',
    error: error.substring(0, 500),  // 截断防 DB 溢出
    attempt,
  });
  logger.warn(`任务失败: ${taskId} (attempt ${attempt}): ${error}`);
}

/**
 * 标记任务死信（重试 3 次仍失败）
 */
export async function markDeadLetter(
  taskId: string,
  error: string
): Promise<void> {
  await updateTaskState(taskId, {
    status: 'dead_letter',
    error: error.substring(0, 500),
  });
  logger.error(`任务死信: ${taskId}: ${error}`);
}

/**
 * 标记任务取消（用户主动）
 */
export async function markCancelled(
  taskId: string
): Promise<void> {
  await updateTaskState(taskId, {
    status: 'cancelled',
  });
  logger.info(`任务取消: ${taskId}`);
}

// ============================================================
// 状态查询
// ============================================================

export async function getTaskState(taskId: string): Promise<{
  id: string;
  status: TaskStatusKind;
  progress: number;
  error: string | null;
  output: Record<string, unknown> | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  userId: string;
  type: string;
  powerCost: number;
  input: Record<string, unknown> | null;
} | null> {
  if (!db) {
    // DB 不可用 → 内存降级（Phase 3: generation-service 的 memoryTasks）
    return getMemoryTaskStateCompat(taskId);
  }

  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    status: row.status as TaskStatusKind,
    progress: row.progress ?? 0,
    error: row.error,
    output: (row.output as Record<string, unknown>) ?? null,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    userId: row.userId,
    type: row.type,
    powerCost: row.powerCost ?? 0,
    input: (row.input as Record<string, unknown>) ?? null,
  };
}

// ============================================================
// 内部函数
// ============================================================

async function updateTaskState(
  taskId: string,
  update: TaskStatusUpdate
): Promise<void> {
  if (!db) {
    logger.warn(`DB 不可用，状态变更失败: ${taskId}`);
    return;
  }

  const now = new Date();
  const setFields: Record<string, unknown> = {
    status: update.status,
    updatedAt: now,
  };

  if (update.progress !== undefined) setFields.progress = update.progress;
  if (update.error !== undefined) setFields.error = update.error;
  if (update.output !== undefined) setFields.output = update.output;
  if (update.attempt !== undefined) setFields.attempt = update.attempt;

  if (update.status === 'processing') setFields.startedAt = now;
  if (update.status === 'completed' || update.status === 'cancelled' || update.status === 'dead_letter') {
    setFields.completedAt = now;
  }

  await db.update(tasks).set(setFields).where(eq(tasks.id, taskId));
}


// ============================================================
// DB 不可用时的内存降级（Phase 3）
// ============================================================

async function getMemoryTaskStateCompat(taskId: string) {
  try {
    const { getMemoryTaskState } = await import('@/lib/ai/application/generation-service');
    const t = getMemoryTaskState(taskId);
    if (!t) return null;
    return {
      id: t.id,
      status: t.status as TaskStatusKind,
      progress: t.progress,
      error: t.error,
      output: t.output,
      startedAt: t.startedAt ? new Date(t.startedAt) : null,
      completedAt: t.completedAt ? new Date(t.completedAt) : null,
      createdAt: new Date(t.createdAt),
      userId: t.userId,
      type: t.type,
      powerCost: t.powerCost,
      input: null,
    };
  } catch {
    return null;
  }
}
