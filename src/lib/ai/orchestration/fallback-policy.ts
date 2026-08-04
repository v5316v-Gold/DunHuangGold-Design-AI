/**
 * Phase 4.3 · 兜底策略（Fallback Policy）
 *
 * Spec: 05-L3-Orchestration §8 + ADR-012（provider 自动降级）
 *
 * 职责：主执行器失败后，按 fallbackChain 依次尝试下一个执行器；
 * 全部失败 → 任务进入 dead_letter（或按 retry-policy 重试）。
 */

import type { ExecutorType } from '../ports/executor.port';
import type { ExecutionPlan, ExecutionTrace } from '../domain/execution-plan';

export interface FallbackDecision {
  /** 下一个要尝试的执行器（无则 null） */
  nextExecutor: ExecutorType | null;
  /** 是否已耗尽所有执行器 */
  exhausted: boolean;
}

/**
 * 决策兜底：从 fallbackChain 中找出尚未尝试过的下一个执行器
 */
export function decideFallback(
  plan: ExecutionPlan,
  trace: ExecutionTrace
): FallbackDecision {
  const attempted = new Set(trace.attempted.map((a) => a.executorId));
  const next = plan.fallbackChain.find((id) => !attempted.has(id));

  if (next) {
    return { nextExecutor: next, exhausted: false };
  }
  return { nextExecutor: null, exhausted: true };
}

/**
 * 主执行器 + 兜底链 = 完整尝试序列（含主执行器本身）
 */
export function fullExecutionChain(plan: ExecutionPlan): ExecutorType[] {
  return [plan.executorId, ...plan.fallbackChain];
}

/** 全部候选执行器是否都已尝试 */
export function allAttempted(plan: ExecutionPlan, trace: ExecutionTrace): boolean {
  const chain = fullExecutionChain(plan);
  const attempted = new Set(trace.attempted.map((a) => a.executorId));
  return chain.every((id) => attempted.has(id));
}
