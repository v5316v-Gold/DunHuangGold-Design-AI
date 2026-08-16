/**
 * Phase 4 · 新一代 FeatureOrchestrator（策略驱动）
 *
 * 对齐蓝图 05-L3-Orchestration + ADR-002/009/010/011：
 *   - 用 routing-policy 决定主执行器 + fallbackChain
 *   - 用 retry-policy 判断失败是否重试
 *   - 用 fallback-policy 决策兜底执行器
 *   - 生成 ExecutionPlan 快照（domain/execution-plan）
 *   - 任务状态流转强制（queued→processing→completed/failed/cancelled/dead_letter）
 *
 * 兼容：旧 FeatureOrchestrator 保留（src/lib/orchestrator/），本类为增量新入口。
 * 消费方：GenerationService.executeSync 走新 orchestrator（可切换）。
 */

import { randomUUID } from 'crypto';
import { db } from '@/db';
import { features } from '@/db/schema/features';
import { eq } from 'drizzle-orm';
import { FEATURE_DEFINITIONS } from '@/config/features';
import { getFeatureCost } from '@/lib/feature-costs';
import { logAudit } from '@/lib/audit-logger';
import type { Executor, ExecutorType, ExecutorResult } from '../ports/executor.port';
import {
  createExecutionPlan,
  createExecutionTrace,
  type ExecutionPlan,
} from '../domain/execution-plan';
import { decideRouting, type FeatureRoutingConfig } from './routing-policy';
import { shouldRetry, type RetryDecision } from './retry-policy';
import { decideFallback } from './fallback-policy';

// ==================== 执行器注册 ====================

interface OrchestratorOptions {
  executors?: Executor[];
  /** 是否在生产（mock 仅非生产，ADR-010） */
  production?: boolean;
}

export class PolicyOrchestrator {
  private readonly executors = new Map<ExecutorType, Executor>();
  private readonly production: boolean;

  constructor(options: OrchestratorOptions = {}) {
    this.production = options.production ?? process.env.NODE_ENV === 'production';
    for (const ex of options.executors ?? []) {
      this.executors.set(ex.id, ex);
    }
  }

  register(executor: Executor): void {
    this.executors.set(executor.id, executor);
  }

  // ==================== 配置加载 ====================

  private async loadFeatureConfig(featureId: string): Promise<
    (FeatureRoutingConfig & { enabled: boolean; cost: number; name?: string }) | null
  > {
    if (db) {
      try {
        const rows = await db.select().from(features).where(eq(features.id, featureId)).limit(1);
        if (rows[0]) {
          return {
            defaultExecutor: rows[0].defaultExecutor ?? null,
            fallbackExecutors: (rows[0].fallbackExecutors ?? []) as string[],
            enabled: rows[0].enabled ?? true,
            cost: rows[0].cost ?? getFeatureCost(featureId),
            name: rows[0].name,
          };
        }
      } catch {
        // DB 失败 → seed 兜底（fail-open）
      }
    }
    const definition = FEATURE_DEFINITIONS[featureId];
    return definition
      ? {
          enabled: true,
          cost: getFeatureCost(featureId),
          name: definition.name,
        }
      : null;
  }

  // ==================== 主执行 ====================

  /**
   * 构造 ExecutionPlan 快照（不执行）。
   * 供 generation-service 在落库前调用，把 plan 持久化到 tasks.execution_plan，
   * Worker 重试时按 plan 执行而不是重新 decideRouting（ADR-009 冻结语义）。
   */
  async buildPlan(req: {
    featureId: string;
    userId: string;
    inputs: Record<string, unknown>;
    taskId?: string;
  }): Promise<ExecutionPlan | { error: string; code: string }> {
    const feature = await this.loadFeatureConfig(req.featureId);
    if (!feature) {
      return { error: `功能 ${req.featureId} 不存在`, code: 'FEATURE_NOT_FOUND' };
    }
    if (!feature.enabled) {
      return { error: `功能 ${req.featureId} 已被关闭`, code: 'FEATURE_DISABLED' };
    }
    const routing = decideRouting(req.featureId, feature);
    if (this.production && routing.executorId === 'mock') {
      return { error: 'mock 执行器不允许在生产环境使用', code: 'PROVIDER_UNAVAILABLE' };
    }
    return createExecutionPlan({
      taskId: req.taskId ?? `plan_${randomUUID()}`,
      featureId: req.featureId,
      userId: req.userId,
      executorId: routing.executorId,
      fallbackChain: routing.fallbackChain,
      estimatedCost: feature.cost,
      inputsSnapshot: req.inputs,
    });
  }

  async execute(req: {
    featureId: string;
    userId: string;
    inputs: Record<string, unknown>;
    traceId?: string;
    requestId?: string;
    /** 可选：传入冻结的 ExecutionPlan（来自 tasks.execution_plan），跳过 decideRouting */
    plan?: ExecutionPlan;
  }): Promise<ExecutorResult> {
    const traceId = req.traceId ?? `trace_${randomUUID()}`;
    const requestId = req.requestId ?? `req_${randomUUID()}`;

    // 1. 加载功能配置（仅在没传 plan 时需要 — 用于 enabled 校验）
    let feature: Awaited<ReturnType<PolicyOrchestrator['loadFeatureConfig']>>;
    if (req.plan) {
      // 有 plan：feature 仍要查一次以做 enabled 校验
      feature = await this.loadFeatureConfig(req.featureId);
      if (!feature) {
        return this.fail(req.featureId, 'FEATURE_NOT_FOUND', `功能 ${req.featureId} 不存在`, false, traceId);
      }
      if (!feature.enabled) {
        return this.fail(req.featureId, 'FEATURE_DISABLED', `功能 ${req.featureId} 已被关闭`, false, traceId);
      }
    } else {
      feature = await this.loadFeatureConfig(req.featureId);
      if (!feature) {
        return this.fail(req.featureId, 'FEATURE_NOT_FOUND', `功能 ${req.featureId} 不存在`, false, traceId);
      }
      if (!feature.enabled) {
        return this.fail(req.featureId, 'FEATURE_DISABLED', `功能 ${req.featureId} 已被关闭`, false, traceId);
      }
    }

    // 2. 路由决策（routing-policy）
    // 若调用方已传入冻结的 plan（来自 tasks.execution_plan），直接使用，跳过重新路由
    let plan: ExecutionPlan;
    if (req.plan) {
      plan = req.plan;
    } else {
      const routing = decideRouting(req.featureId, feature);
      if (this.production && routing.executorId === 'mock') {
        return this.fail(req.featureId, 'PROVIDER_UNAVAILABLE', 'mock 执行器不允许在生产环境使用', false, traceId);
      }
      // 3. 生成 ExecutionPlan 快照
      plan = createExecutionPlan({
        taskId: (req.inputs.taskId as string) ?? `plan_${randomUUID()}`,
        featureId: req.featureId,
        userId: req.userId,
        executorId: routing.executorId,
        fallbackChain: routing.fallbackChain,
        estimatedCost: feature.cost,
        inputsSnapshot: req.inputs,
      });
    }
    const trace = createExecutionTrace(plan);

    // 4. 执行链：主执行器 → 兜底链（fallback-policy）
    let attempt = 0;
    let currentExecutor: ExecutorType | null = plan.executorId;
    while (currentExecutor) {
      const executor = this.executors.get(currentExecutor);
      const supports = executor?.capabilities().has(req.featureId);
      if (!executor || !supports) {
        // 跳过不支持的执行器 — 必须把当前 executor 记入 trace.attempted,
        // 否则 decideFallback 会无限循环拿回同一个 executor
        trace.attempted.push({
          executorId: currentExecutor,
          success: false,
          errorCode: executor ? 'NOT_SUPPORTED' : 'EXECUTOR_MISSING',
          latencyMs: 0,
          at: new Date().toISOString(),
        });
        const fb = decideFallback(plan, trace);
        currentExecutor = fb.nextExecutor;
        continue;
      }

      const started = Date.now();
      let result: ExecutorResult;
      try {
        // Phase 9.26 · 执行超时防护（防止外部 API 无限挂起占住 worker）
        // ComfyUI 不可用 / Minimax 网络抖动时快速失败 → fallback 或 dead_letter
        const EXECUTOR_TIMEOUT_MS = 120_000; // 120s 上限
        result = await Promise.race([
          executor.execute({
            featureId: req.featureId,
            userId: req.userId,
            inputs: req.inputs,
            traceId,
            requestId,
            plan,
            _feature: feature as unknown,
          } as never),
          new Promise<ExecutorResult>((_, reject) =>
            setTimeout(
              () => reject(new Error(`执行器超时(${EXECUTOR_TIMEOUT_MS / 1000}s): ${currentExecutor}`)),
              EXECUTOR_TIMEOUT_MS
            )
          ),
        ]);
      } catch (error) {
        result = {
          success: false,
          error: {
            code: 'EXECUTOR_EXCEPTION',
            message: (error as Error).message,
            retryable: true,
          },
          executorUsed: currentExecutor,
          cost: 0,
          latencyMs: Date.now() - started,
          traceId,
        };
      }

      trace.attempted.push({
        executorId: currentExecutor,
        success: result.success,
        errorCode: result.error?.code,
        latencyMs: result.latencyMs,
        at: new Date().toISOString(),
      });

      if (result.success) {
        await logAudit({
          action: 'feature.execute',
          resourceType: 'feature',
          resourceId: req.featureId,
          actorId: req.userId,
          details: {
            executorUsed: result.executorUsed,
            provider: result.provider,
            cost: result.cost,
            latencyMs: result.latencyMs,
            traceId,
            planVersion: plan.planVersion,
          },
        }).catch(() => undefined);
        return result;
      }

      // 失败 → retry-policy 判断
      const retry: RetryDecision = shouldRetry(result.error?.code, attempt);
      if (retry.verdict === 'no_retry') {
        return result;
      }

      // 兜底链下一个执行器
      const fb = decideFallback(plan, trace);
      if (fb.exhausted) {
        // Phase 9.26 · 修复死循环：fallback 链耗尽时不再原地重试同一 executor。
        // 原地 continue 会无限重试（executor 永远失败 → CPU 100%）。
        // 交给外层：BullMQ 重试 / 死信处理。
        break;
      }
      currentExecutor = fb.nextExecutor;
      attempt += 1;
    }

    return this.fail(
      req.featureId,
      'ALL_EXECUTORS_FAILED',
      '所有执行器都失败',
      true,
      traceId
    );
  }

  private fail(
    featureId: string,
    code: string,
    message: string,
    retryable: boolean,
    traceId: string
  ): ExecutorResult {
    return {
      success: false,
      error: { code, message, retryable },
      executorUsed: 'mock',
      cost: 0,
      latencyMs: 0,
      traceId,
    };
  }
}

export const policyOrchestrator = new PolicyOrchestrator();
