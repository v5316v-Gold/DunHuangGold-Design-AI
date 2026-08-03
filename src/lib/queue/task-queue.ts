/**
 * 任务队列封装（基于 BullMQ）
 *
 * 职责：
 * 1. Producer: 业务后端把任务入队，立即返回
 * 2. Consumer: Worker 进程消费任务
 * 3. 幂等: Redis SETNX 防止重复提交
 *
 * 为什么用 BullMQ：
 * - 成熟、重试/延迟/UI 全有
 * - Redis 内置（项目已有 Redis 计划）
 * - 比 Redis Stream 内置更多特性
 */

import { Queue, type Job, type JobsOptions } from 'bullmq';
import { getBullConnection } from '../redis';
import type { AIServiceType } from '@/lib/ai-service/types';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('task-queue');

const QUEUE_NAME = 'ai-tasks';

// ============================================================
// 任务载荷
// ============================================================

export interface TaskPayload {
  /** 业务侧任务 ID（UUID，对应 tasks 表） */
  taskId: string;
  /** 提交任务的用户 ID */
  userId: string;
  /** AI 服务类型 */
  serviceType: AIServiceType;
  /** 业务参数（prompt, image, 等） */
  params: Record<string, unknown>;
  /** 幂等键（去重用，userId+service+params hash） */
  idempotencyKey: string;
}

// ============================================================
// 队列实例（单例）
// ============================================================

let _queue: Queue<TaskPayload> | null = null;

function getQueue(): Queue<TaskPayload> {
  if (!_queue) {
    _queue = new Queue<TaskPayload>(QUEUE_NAME, {
      connection: getBullConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },  // 5s / 25s / 125s
        removeOnComplete: { age: 86400, count: 1000 },  // 保留 1 天 / 1000 条
        removeOnFail: { age: 604800 },                  // 失败保留 7 天
      },
    });
    logger.info('任务队列初始化完成');
  }
  return _queue;
}

// ============================================================
// 幂等检查
// ============================================================

/**
 * 检查幂等键（业务层 SETNX 实现）
 *
 * @returns true = 通过（首次提交），false = 重复（应拒绝）
 */
export async function checkIdempotency(
  key: string,
  ttlSec = 3600
): Promise<boolean> {
  const { getRedis } = await import('../redis');
  const result = await getRedis().set(`idem:${key}`, '1', 'EX', ttlSec, 'NX');
  return result === 'OK';
}

/**
 * 释放幂等键（任务失败需重试时调用）
 */
export async function releaseIdempotency(key: string): Promise<void> {
  const { getRedis } = await import('../redis');
  await getRedis().del(`idem:${key}`);
}

// ============================================================
// 入队（Producer）
// ============================================================

export interface EnqueueResult {
  jobId: string;
  taskId: string;
  duplicate: boolean;
}

/**
 * 入队 AI 任务
 *
 * 流程：
 * 1. 检查幂等（避免重复提交）
 * 2. 入队 BullMQ
 * 3. 返回 jobId
 *
 * 注意：幂等键检查失败时返回 duplicate=true，调用方应返回 429
 */
export async function enqueueTask(
  payload: TaskPayload,
  options?: JobsOptions
): Promise<EnqueueResult> {
  // 1. 幂等检查
  const isFirst = await checkIdempotency(payload.idempotencyKey);
  if (!isFirst) {
    logger.warn(`重复任务被拒绝: ${payload.idempotencyKey}`);
    return {
      jobId: '',
      taskId: payload.taskId,
      duplicate: true,
    };
  }

  // 2. 入队
  const job = await getQueue().add(payload.serviceType, payload, {
    jobId: `${payload.taskId}`,
    ...options,
  });

  logger.info(`任务已入队: ${payload.taskId} (${payload.serviceType})`);
  return {
    jobId: job.id ?? payload.taskId,
    taskId: payload.taskId,
    duplicate: false,
  };
}

// ============================================================
// 状态查询
// ============================================================

export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const counts = await getQueue().getJobCounts(
    'waiting',
    'active',
    'completed',
    'failed',
    'delayed'
  );
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
  };
}

export async function getJobByTaskId(taskId: string): Promise<Job<TaskPayload> | undefined> {
  // BullMQ 用 jobId 索引，不直接支持 taskId 查
  // 用 taskId 作为 jobId 即可
  return await getQueue().getJob(taskId) as Job<TaskPayload> | undefined;
}

// ============================================================
// 关闭（graceful shutdown）
// ============================================================

export async function closeTaskQueue(): Promise<void> {
  if (_queue) {
    await _queue.close();
    _queue = null;
    logger.info('任务队列已关闭');
  }
}