/**
 * Phase 4.1 · Executor Port（Hexagonal 架构核心接口）
 *
 * Spec: 05-L3-Orchestration §4 + ADR-002（orchestrator 强制 AI 入口）
 *       + ADR-010（mock 仅非生产）+ ADR-014（repository 抽象）
 *
 * 依赖规则（蓝图 1.3）：
 *   - L3 orchestration 依赖本 Port，不依赖具体 Adapter
 *   - Adapter（comfyui/third-party/mock）实现本 Port，可替换
 *   - L2 路由永远不直接触碰 Adapter
 */

import type { ExecutionPlan } from '../domain/execution-plan';

// ==================== 执行结果 ====================

export interface ExecutorArtifact {
  url: string;
  mime: string;
  sha256?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecutorResult {
  success: boolean;
  artifacts?: ExecutorArtifact[];
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    providerError?: string;
  };
  /** 实际使用的执行器 id */
  executorUsed: string;
  provider?: string;
  cost: number;
  latencyMs: number;
  traceId: string;
  /** 原始返回（供 adapter 透传） */
  raw?: unknown;
}

// ==================== 执行请求 ====================

export interface ExecutorRequest {
  /** 功能 ID（短 id：text2img / refine / relief …） */
  featureId: string;
  userId: string;
  /** 用户提交的业务参数 */
  inputs: Record<string, unknown>;
  traceId: string;
  requestId: string;
  /** 编排器生成的执行计划（含 fallbackChain / workflowId） */
  plan: ExecutionPlan;
  /** adapter 内部使用的功能配置（DB 或 seed 兜底） */
  feature?: unknown;
}

// ==================== Executor Port ====================

export type ExecutorType = 'mock' | 'comfyui' | 'third-party';

export interface Executor {
  /** 唯一标识（mock / comfyui / third-party） */
  readonly id: ExecutorType;
  /** 是否生产可用（mock 仅限非生产，ADR-010） */
  readonly productionSafe: boolean;
  /** 支持的功能 ID 集合 */
  capabilities(): Set<string>;
  /** 健康检查（可选，默认 true） */
  isAvailable?(): Promise<boolean>;
  /** 执行生成 */
  execute(req: ExecutorRequest): Promise<ExecutorResult>;
}

// ==================== 注册表 Port ====================

/** Executor 注册表（供 orchestrator 查询可用执行器） */
export interface IExecutorRegistry {
  get(id: ExecutorType): Executor | undefined;
  all(): Executor[];
  /** 返回支持某功能且可用的执行器列表（按传入顺序） */
  candidatesFor(featureId: string, availableOnly?: boolean): Promise<Executor[]>;
}

// ==================== 默认导出 ====================

export const EXECUTOR_ORDER: ExecutorType[] = ['third-party', 'comfyui', 'mock'];
