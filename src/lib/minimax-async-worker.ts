/**
 * Phase 9.20 · Minimax 异步任务轮询 worker
 *
 * 处理 minimax 视频/音乐的 task_id 轮询：
 * - 提交任务 → 写 tasks 表（status: queued）
 * - BullMQ 延迟任务（30s 后查询）
 * - status === 'Success' → download + 写 works 表 + status: completed
 * - status === 'Failed' → release 算力 + status: failed
 * - status === 'Preparing'/'Processing' → 继续轮询（最长 10 分钟）
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { tasks } from '@/db/schema/_tables';
import { minimaxVideoQuery } from './minimax-call-service';
import { powerLedger } from '@/lib/ai/application/power-ledger';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('minimax-async');

const MAX_POLL_DURATION_MS = 10 * 60 * 1000; // 10 分钟
const POLL_INTERVAL_MS = 10 * 1000; // 10s

/**
 * 轮询任务状态
 */
export type MinimaxTaskStatus = 'Preparing' | 'Processing' | 'Success' | 'Failed' | string;

export interface MinimaxTaskState {
  status: MinimaxTaskStatus;
  fileId?: string;
}

/**
 * 查询 minimax 视频/音乐任务状态
 */
export async function pollMinimaxTask(taskId: string): Promise<MinimaxTaskState> {
  const result = await minimaxVideoQuery(taskId);
  return {
    status: result.status,
    fileId: result.file_id || undefined,
  };
}

/**
 * 轮询直到完成或超时
 */
export async function waitForMinimaxTask(
  taskId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<MinimaxTaskState> {
  const interval = options.intervalMs || POLL_INTERVAL_MS;
  const timeout = options.timeoutMs || MAX_POLL_DURATION_MS;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const state = await pollMinimaxTask(taskId);
    if (state.status === 'Success' || state.status === 'Failed') {
      return state;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Minimax task ${taskId} 轮询超时 (${timeout}ms)`);
}

/**
 * 处理任务完成（成功）
 * - 更新 tasks 表 status: completed
 * - PowerLedger.consume()（扣算力）
 * - TODO: 下载文件 + 写 works 表
 */
export async function handleMinimaxTaskSuccess(
  taskDbId: string,
  meta: { taskId: string; featureId: string; userId: string; traceId: string }
): Promise<void> {
  if (!db) {
    logger.warn('[minimax-async] DB 不可用，跳过任务状态更新');
    return;
  }
  try {
    await db
      .update(tasks)
      .set({ status: 'completed' })
      .where(eq(tasks.id, taskDbId));
    logger.info(`[minimax-async] 任务 ${meta.taskId} (DB ${taskDbId}) 标记完成`);
    // TODO: 调用 powerLedger.consume(taskId) 扣算力
    // TODO: 下载 file_id 文件 + 写 works 表
  } catch (err) {
    logger.error('[minimax-async] 任务完成处理失败:', err);
  }
}

/**
 * 处理任务失败
 * - 更新 tasks 表 status: failed
 * - PowerLedger.release()（释放算力）
 */
export async function handleMinimaxTaskFailure(
  taskDbId: string,
  meta: { taskId: string; featureId: string; userId: string; traceId: string; reason: string }
): Promise<void> {
  if (!db) return;
  try {
    await db
      .update(tasks)
      .set({ status: 'failed' })
      .where(eq(tasks.id, taskDbId));
    logger.warn(`[minimax-async] 任务 ${meta.taskId} (DB ${taskDbId}) 标记失败: ${meta.reason}`);
    // TODO: 调用 powerLedger.release(taskId) 释放算力
  } catch (err) {
    logger.error('[minimax-async] 任务失败处理失败:', err);
  }
}

/**
 * 轮询并处理（主入口）
 * - 用于 BullMQ delayed job 或定时任务
 */
export async function pollAndProcess(taskDbId: string, meta: { taskId: string; featureId: string; userId: string; traceId: string }): Promise<void> {
  try {
    const state = await pollMinimaxTask(meta.taskId);
    if (state.status === 'Success') {
      await handleMinimaxTaskSuccess(taskDbId, meta);
    } else if (state.status === 'Failed') {
      await handleMinimaxTaskFailure(taskDbId, { ...meta, reason: state.status });
    } else {
      // 仍 Preparing/Processing：调度下一次轮询
      logger.info(`[minimax-async] 任务 ${meta.taskId} 状态 ${state.status}，继续轮询`);
      // TODO: 调度 BullMQ delayed job（10s 后重试）
    }
  } catch (err) {
    logger.error(`[minimax-async] 轮询任务 ${meta.taskId} 失败:`, err);
    await handleMinimaxTaskFailure(taskDbId, { ...meta, reason: String(err) });
  }
}
