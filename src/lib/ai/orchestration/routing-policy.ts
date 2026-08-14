/**
 * Phase 4.3 · 路由策略（Routing Policy）
 *
 * Spec: 05-L3-Orchestration §6 + ADR-012（DB 运行时配置）
 *
 * 职责：给定功能，决定主执行器 + 兜底链。
 * 配置来源优先级：DB features 表（default_executor / fallback_executors）→ seed → 默认。
 *
 * Phase 9.23 扩展：ExecutorType 增加 'hermes'
 */

import type { ExecutorType } from '../ports/executor.port';

export interface RoutingDecision {
  executorId: ExecutorType;
  fallbackChain: ExecutorType[];
}

/** DB 配置形状（features 表相关列） */
export interface FeatureRoutingConfig {
  defaultExecutor?: string | null;
  fallbackExecutors?: string[] | null;
}

/** 已知执行器顺序（用于排序/补全兜底链） */
const KNOWN_ORDER: ExecutorType[] = ['third-party', 'comfyui', 'mock', 'hermes'];

function normalize(value: string): ExecutorType | null {
  // Phase 9.23：兼容新增 'hermes'（AI 对话）
  if (value === 'third-party' || value === 'comfyui' || value === 'mock' || value === 'hermes') {
    return value;
  }
  return null;
}

/**
 * 决策路由：DB 配置 → seed → 默认
 */
export function decideRouting(
  featureId: string,
  config?: FeatureRoutingConfig | null,
  defaultChain: ExecutorType[] = ['third-party', 'comfyui', 'mock']
): RoutingDecision {
  // 1. DB/seed 配置
  const configuredDefault = config?.defaultExecutor
    ? normalize(config.defaultExecutor)
    : null;
  const configuredFallbacks = (config?.fallbackExecutors ?? [])
    .map(normalize)
    .filter((x): x is ExecutorType => x !== null);

  if (configuredDefault) {
    return {
      executorId: configuredDefault,
      fallbackChain: configuredFallbacks,
    };
  }

  // 2. 默认链
  const [primary, ...rest] = defaultChain;
  return {
    executorId: primary ?? 'third-party',
    fallbackChain: rest,
  };
}

/**
 * 按可用性过滤执行器（健康检查，仅非生产可选跳过）
 */
export async function filterAvailable(
  candidates: ExecutorType[],
  isAvailable: (id: ExecutorType) => Promise<boolean>
): Promise<ExecutorType[]> {
  const results = await Promise.all(
    candidates.map(async (id) => ({ id, ok: await isAvailable(id) }))
  );
  return results.filter((r) => r.ok).map((r) => r.id);
}

/** 默认路由（无配置时） */
export function defaultRouting(): RoutingDecision {
  return {
    executorId: 'third-party',
    fallbackChain: ['comfyui', 'mock'],
  };
}

/** 供测试/调试 */
export const _KNOWN_ORDER = KNOWN_ORDER;
