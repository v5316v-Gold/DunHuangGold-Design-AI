/**
 * Phase 3 · GenerationService（统一生成入口）
 *
 * Spec: docs/03-L2-API.md §4 + ADR-002（orchestrator 强制 AI 入口）
 *       + ADR-004（异步优先 BullMQ）+ ADR-008（算力预扣无双扣）+ ADR-011（任务状态机集中）
 *
 * 职责（对齐 EXECUTION-PLAN Phase 3.1~3.5）：
 *   1. create      —— 统一任务创建：校验 → 算力预扣 → 落库 → 入队
 *   2. query       —— 统一任务查询（含权限校验）
 *   3. cancel      —— 统一任务取消（状态机限制）
 *   4. retry       —— 统一失败重试（释放/重建幂等键）
 *   5. reserve/consume/release —— 算力预扣三态，杜绝双扣
 *   6. audit + telemetry —— requestId/traceId 贯通，全部操作留审计
 *
 * 边界规则：
 *   - L2 路由只做 HTTP 解析/鉴权/限流，业务全部委托本服务
 *   - 本服务不直接触碰 Redis/ComfyUI/BullMQ 之外的第三方（队列经 task-queue 封装）
 *   - DB 不可用时降级为内存态（本地开发/测试可运行），生产依赖 PG
 */

import { randomUUID } from 'crypto';
import { db } from '@/db';
import { tasks } from '@/db/schema/_tables';
import { eq } from 'drizzle-orm';
import { createLogger } from '@/lib/error-handler';
import { logAudit } from '@/lib/audit-logger';
import {
  enqueueTask,
  releaseIdempotency,
  type TaskPayload,
} from '@/lib/queue/task-queue';
import { getTaskState } from '@/lib/queue/task-state';
import {
  checkUserPower,
  deductUserPower,
  refundUserPower,
} from '@/lib/ai-service/power-helper';
import { powerLedger } from '@/lib/ai/application/power-ledger';
import { getFeatureCost } from '@/lib/feature-costs';
import { policyOrchestrator } from '@/lib/ai/orchestration/policy-orchestrator';
import {
  memoryTasks,
  createMemoryTask,
  updateMemoryTask,
} from '@/lib/queue/memory-task-store';
import type { AIServiceType } from '@/lib/ai-service/types';

const logger = createLogger('generation-service');

// ============================================================
// 类型定义
// ============================================================

export interface GenerationCreateInput {
  /** 功能 ID（短 id：text2img / refine / relief …） */
  featureId: string;
  /** 请求参数（prompt / image / …） */
  params: Record<string, unknown>;
  /** 幂等键（可选，缺省由 userId+featureId+params 派生） */
  idempotencyKey?: string;
}

export interface GenerationCreateResult {
  success: boolean;
  taskId?: string;
  status?: string;
  duplicate?: boolean;
  code?: string;
  message?: string;
  details?: unknown;
  /** 本次预扣算力 */
  reservedPower?: number;
  /** 队列不可用时降级标记（任务已记录，待 Worker 补消费） */
  enqueueDegraded?: boolean;
}

export interface GenerationQueryResult {
  found: boolean;
  owned: boolean;
  task?: {
    id: string;
    status: string;
    progress: number;
    error: string | null;
    output: Record<string, unknown> | null;
    type: string;
    powerCost: number;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
  };
}

export interface GenerationCancelResult {
  success: boolean;
  code?: string;
  message?: string;
  status?: string;
}

export interface GenerationRetryResult {
  success: boolean;
  taskId?: string;
  duplicate?: boolean;
  code?: string;
  message?: string;
}

// 任务状态机允许的流转（ADR-011）
const CANCELLABLE_STATUSES = new Set(['pending', 'processing']);
const RETRYABLE_STATUSES = new Set(['failed', 'dead_letter']);

// ============================================================
// 幂等键派生
// ============================================================

function deriveIdempotencyKey(
  userId: string,
  featureId: string,
  params: Record<string, unknown>
): string {
  const sorted = JSON.stringify(params, Object.keys(params).sort());
  return `${userId}:${featureId}:${sorted}`;
}

function isKnownServiceType(value: string): value is AIServiceType {
  const known: AIServiceType[] = [
    'text2img', 'refine', 'relief', 'image3d', 'stereo',
    'removebg', 'upscale', 'watermark', 'sketch', 'blend',
    'oneclick', 'multiview', 'free', 'text2video', 'img2video',
    'dialogue', 'ai-assistant',
  ];
  return known.includes(value as AIServiceType);
}

// ============================================================
// GenerationService
// ============================================================

class GenerationService {
  /**
   * 统一任务创建（Phase 3.2 路由委托入口）
   *
   * 流程：校验 → 算力预扣(reserve) → tasks 落库 → 入队(BullMQ)
   * 幂等：重复提交返回 duplicate（不双扣，ADR-008）
   */
  async create(
    userId: string,
    input: GenerationCreateInput,
    ctx: { requestId: string; traceId?: string }
  ): Promise<GenerationCreateResult> {
    const { featureId, params } = input;
    const traceId = ctx.traceId ?? ctx.requestId;

    // 1. 功能/服务类型校验
    if (!featureId) {
      return { success: false, code: 'INVALID_INPUT', message: '缺少 featureId 参数' };
    }
    if (!isKnownServiceType(featureId)) {
      return {
        success: false,
        code: 'INVALID_INPUT',
        message: `不支持的服务类型: ${featureId}`,
      };
    }

    // 2. 算力预扣（前置检查，不落账——落账在任务完成时 consume）
    const cost = getFeatureCost(featureId);
    const hasPower = await checkUserPower(userId, cost);
    if (!hasPower) {
      return {
        success: false,
        code: 'INSUFFICIENT_POWER',
        message: '算力不足',
        details: { required: cost },
      };
    }

    // 3. 幂等键
    const idempotencyKey =
      input.idempotencyKey || deriveIdempotencyKey(userId, featureId, params);

    // 3.5 算力预留（ADR-008：reserve 不立即扣减，任务完成 consume / 失败 release）
    const reservation = await powerLedger.reserve({
      userId,
      featureId,
      amount: cost,
      idempotencyKey,
    }).catch(() => null);
    if (reservation && !reservation.success) {
      return {
        success: false,
        code: 'INSUFFICIENT_POWER',
        message: reservation.error || '算力不足',
        details: { required: cost },
      };
    }

    // 4. 任务落库（统一走 tasks 表，不做散落 insert）
    let taskId = '';
    try {
      if (db) {
        const [task] = await db
          .insert(tasks)
          .values({
            userId,
            type: featureId,
            featureCode: featureId,
            status: 'pending',
            input: params,
            powerCost: cost,
          })
          .returning();
        taskId = task?.id ?? '';
      }
      if (!taskId) {
        // DB 不可用 / insert 失败 → 内存降级（本地开发/测试；生产 DB 正常时走真实落库）
        taskId = randomUUID();
        createMemoryTask({ id: taskId, userId, type: featureId, params, powerCost: cost });
      }
    } catch (error) {
      // DB 连接失败 → 降级内存态（fail-open），不阻断业务
      logger.warn('任务落库失败，降级内存态', error as Error);
      taskId = randomUUID();
      createMemoryTask({ id: taskId, userId, type: featureId, params, powerCost: cost });
    }

    // 5. 入队（幂等检查在 enqueueTask 内：SETNX）
    const payload: TaskPayload = {
      taskId,
      userId,
      serviceType: featureId as AIServiceType,
      params,
      idempotencyKey,
    };
    let enqueue;
    try {
      enqueue = await enqueueTask(payload);
    } catch (error) {
      // 队列（Redis/BullMQ）不可用 → 任务已在 tasks 表/内存态创建成功，
      // 降级为"已记录待消费"（不阻断创建；Worker 恢复后任务可补消费）。
      // 生产依赖 Redis 正常，此处仅为 fail-open 降级路径。
      logger.warn('任务入队失败，降级为已记录待消费', error as Error);
      await logAudit({
        action: 'task.enqueue_degraded',
        resourceType: 'task',
        resourceId: taskId,
        actorId: userId,
        details: { featureId, traceId, error: (error as Error).message },
      }).catch(() => undefined);
      return {
        success: true,
        taskId,
        status: 'pending',
        reservedPower: cost,
        enqueueDegraded: true,
      };
    }

    if (enqueue.duplicate) {
      // 幂等键重复：不双扣（未扣账），返回 duplicate 提示
      return {
        success: false,
        code: 'DUPLICATE_REQUEST',
        message: '任务提交过于频繁，请稍后重试',
        duplicate: true,
        taskId,
      };
    }

    // 6. 审计
    await logAudit({
      action: 'task.create',
      resourceType: 'task',
      resourceId: taskId,
      actorId: userId,
      details: { featureId, cost, traceId },
    }).catch((e) => logger.warn('审计写入失败', e));

    logger.info(`任务已创建: ${taskId} (${featureId}) trace=${traceId}`);
    return {
      success: true,
      taskId,
      status: 'pending',
      reservedPower: cost,
    };
  }

  /**
   * 统一任务查询（含归属校验）
   */
  async query(
    userId: string,
    taskId: string,
    ctx: { requestId: string }
  ): Promise<GenerationQueryResult> {
    const state = await getTaskState(taskId);
    if (!state) {
      return { found: false, owned: false };
    }
    if (state.userId !== userId) {
      return { found: true, owned: false };
    }
    return {
      found: true,
      owned: true,
      task: {
        id: state.id,
        status: state.status,
        progress: state.progress,
        error: state.error,
        output: state.output,
        type: state.type,
        powerCost: state.powerCost,
        startedAt: state.startedAt ? state.startedAt.toISOString() : null,
        completedAt: state.completedAt ? state.completedAt.toISOString() : null,
        createdAt: state.createdAt.toISOString(),
      },
    };
  }

  /**
   * 统一任务取消（状态机限制：仅 pending/processing 可取消）
   */
  async cancel(
    userId: string,
    taskId: string,
    ctx: { requestId: string }
  ): Promise<GenerationCancelResult> {
    const state = await getTaskState(taskId);
    if (!state) {
      return { success: false, code: 'TASK_NOT_FOUND', message: '任务不存在' };
    }
    if (state.userId !== userId) {
      return { success: false, code: 'PERMISSION_DENIED', message: '无权操作他人任务' };
    }
    if (!CANCELLABLE_STATUSES.has(state.status)) {
      return {
        success: false,
        code: 'TASK_NOT_CANCELLABLE',
        message: `当前状态(${state.status})不可取消`,
        status: state.status,
      };
    }

    // 标记取消
    if (db) {
      await db
        .update(tasks)
        .set({ status: 'cancelled', cancelledAt: new Date(), completedAt: new Date() })
        .where(eq(tasks.id, taskId));
    } else {
      updateMemoryTask(taskId, { status: 'cancelled', completedAt: new Date().toISOString() });
    }

    // 释放幂等键（允许同参数重新提交）
    const key = deriveIdempotencyKey(userId, state.type, state.input ?? {});
    await releaseIdempotency(key).catch(() => undefined);

    await logAudit({
      action: 'task.cancel',
      resourceType: 'task',
      resourceId: taskId,
      actorId: userId,
      details: { fromStatus: state.status },
    }).catch(() => undefined);

    return { success: true, status: 'cancelled' };
  }

  /**
   * 统一失败重试（failed/dead_letter 可重试）
   */
  async retry(
    userId: string,
    taskId: string,
    ctx: { requestId: string }
  ): Promise<GenerationRetryResult> {
    const state = await getTaskState(taskId);
    if (!state) {
      return { success: false, code: 'TASK_NOT_FOUND', message: '任务不存在' };
    }
    if (state.userId !== userId) {
      return { success: false, code: 'PERMISSION_DENIED', message: '无权操作他人任务' };
    }
    if (!RETRYABLE_STATUSES.has(state.status)) {
      return {
        success: false,
        code: 'TASK_NOT_CANCELLABLE',
        message: `当前状态(${state.status})不可重试`,
      };
    }

    // 重置状态回 pending + 清错误
    if (db) {
      await db
        .update(tasks)
        .set({
          status: 'pending',
          error: null,
          progress: 0,
          completedAt: null,
          startedAt: null,
        })
        .where(eq(tasks.id, taskId));
    } else {
      updateMemoryTask(taskId, { status: 'pending', error: null, progress: 0 });
    }

    // 重新入队（释放幂等键后重建）
    const key = deriveIdempotencyKey(userId, state.type, state.input ?? {});
    await releaseIdempotency(key).catch(() => undefined);

    const payload: TaskPayload = {
      taskId,
      userId,
      serviceType: state.type as AIServiceType,
      params: (state.input ?? {}) as Record<string, unknown>,
      idempotencyKey: key,
    };
    const enqueue = await enqueueTask(payload).catch(() => null);

    if (!enqueue) {
      return { success: false, code: 'PROVIDER_UNAVAILABLE', message: '任务队列不可用' };
    }
    if (enqueue.duplicate) {
      return {
        success: false,
        code: 'DUPLICATE_REQUEST',
        message: '任务提交过于频繁，请稍后重试',
        duplicate: true,
        taskId,
      };
    }

    await logAudit({
      action: 'task.retry',
      resourceType: 'task',
      resourceId: taskId,
      actorId: userId,
      details: { fromStatus: state.status },
    }).catch(() => undefined);

    return { success: true, taskId };
  }

  /**
   * 算力结算（任务完成时 consume；失败/取消时 release 退还）
   * 与 task-state 状态变更联动，杜绝双扣（ADR-008）
   */
  async settlePower(
    userId: string,
    taskId: string,
    outcome: 'consume' | 'release'
  ): Promise<{ success: boolean; error?: string }> {
    // Phase 6.5：优先走 PowerLedger 三态结算（reserve 已在 create 时建立）
    const reservation = await powerLedger.findByTask(userId, taskId).catch(() => null);
    if (reservation && reservation.status === 'reserved') {
      const res = await powerLedger.settle(reservation.id, outcome);
      if (res.success) {
        await logAudit({
          action: outcome === 'consume' ? 'power.consume' : 'power.release',
          resourceType: 'task',
          resourceId: taskId,
          actorId: userId,
          details: { cost: reservation.amount, ledger: true },
        }).catch(() => undefined);
        return { success: true };
      }
      return res;
    }

    // 兜底：无 ledger 预留时走旧 deduct/refund（兼容历史任务）
    const state = await getTaskState(taskId);
    if (!state) return { success: false, error: '任务不存在' };

    const cost = state.powerCost || 0;
    if (outcome === 'consume') {
      const res = await deductUserPower(userId, state.type, cost);
      if (!res.success) {
        await logAudit({
          action: 'power.consume_failed',
          resourceType: 'task',
          resourceId: taskId,
          actorId: userId,
          details: { cost, error: res.error },
        }).catch(() => undefined);
        return { success: false, error: res.error };
      }
    } else {
      await refundUserPower(userId, state.type, cost).catch(() => undefined);
    }

    await logAudit({
      action: outcome === 'consume' ? 'power.consume' : 'power.release',
      resourceType: 'task',
      resourceId: taskId,
      actorId: userId,
      details: { cost },
    }).catch(() => undefined);

    return { success: true };
  }

  /**
   * 同步执行（兼容旧 /api/ai/generate：内部走 orchestrator）
   */
  async executeSync(
    userId: string,
    input: GenerationCreateInput,
    ctx: { requestId: string; traceId?: string }
  ): Promise<{
    success: boolean;
    result?: unknown;
    error?: { code: string; message: string };
    traceId?: string;
  }> {
    const traceId = ctx.traceId ?? ctx.requestId;
    const result = await policyOrchestrator.execute({
      featureId: input.featureId,
      userId,
      inputs: input.params,
      traceId,
    });
    if (result.success) {
      await logAudit({
        action: 'feature.execute',
        resourceType: 'feature',
        resourceId: input.featureId,
        actorId: userId,
        details: { executorUsed: result.executorUsed, cost: result.cost, traceId },
      }).catch(() => undefined);
    }
    return {
      success: result.success,
      result: result.success ? result : undefined,
      error: result.success ? undefined : result.error,
      traceId: result.traceId,
    };
  }
}

export const generationService = new GenerationService();
