/**
 * Phase 4.2 · ExecutionPlan（每任务持久化执行计划）
 *
 * Spec: 05-L3-Orchestration §5 + ADR-011（中央任务状态机）+ ADR-009（workflow 版本不可变）
 *
 * ExecutionPlan 是任务执行的"快照"：
 * - 创建任务时生成并持久化（tasks 表 execution_plan 列或独立表）
 * - Worker 消费时读取 plan，按 fallbackChain 依次尝试执行器
 * - 重试时基于 plan 重新执行，不重新路由
 *
 * Phase 9.23 · Workflow Asset Closure：
 *   - 冻结 workflowVersion / models / loras / controlnets / executorId / fallbackChain
 *   - 即使管理员切换 Active Workflow，已创建任务的 ExecutionPlan 不变
 *   - disabled 模型不会被写入新 ExecutionPlan
 */

import type { ExecutorType } from '../ports/executor.port';

/** 模型快照（Phase 9.23 冻结） */
export interface ModelSnapshot {
  id: string;
  sha256: string;
  status: 'available' | 'missing' | 'disabled' | 'incompatible';
}

/** LoRA / ControlNet 快照（Phase 9.23 冻结） */
export interface AssetSnapshot {
  id: string;
  sha256: string;
  triggerWords?: string[];
  weight?: number;
}

// ==================== 执行计划 ====================

export interface ExecutionPlan {
  /** 业务任务 ID（tasks.id） */
  taskId: string;
  /** 功能 ID（短 id） */
  featureId: string;
  userId: string;
  /** 主执行器 */
  executorId: ExecutorType;
  /** 兜底执行器链（按优先级） */
  fallbackChain: ExecutorType[];
  /** 工作流 ID（如 text2img-z-turbo），可为空 */
  workflowId?: string;
  /** 工作流版本（immutable，ADR-009） */
  workflowVersion?: number;
  /** Phase 9.23：模型快照（创建时 frozen，运行中不变） */
  models: ModelSnapshot[];
  /** Phase 9.23：LoRA 快照 */
  loras: AssetSnapshot[];
  /** Phase 9.23：ControlNet 快照 */
  controlnets: AssetSnapshot[];
  /** 期望成本（预扣用） */
  estimatedCost: number;
  /** 输入参数快照（与任务输入一致，防后续变更） */
  inputsSnapshot: Record<string, unknown>;
  /** 计划生成时间 */
  createdAt: string;
  /** 计划版本（每次重试 +1） */
  planVersion: number;
}

// ==================== 执行跟踪 ====================

export interface ExecutionTrace {
  taskId: string;
  planVersion: number;
  /** 已尝试的执行器序列 */
  attempted: Array<{
    executorId: ExecutorType;
    success: boolean;
    errorCode?: string;
    latencyMs?: number;
    at: string;
  }>;
  /** 当前尝试次数（0-based） */
  attempt: number;
  /** 最大尝试次数 */
  maxAttempts: number;
}

// ==================== 构造与工具 ====================

/** 构建初始 ExecutionPlan（无 history 时） */
export function createExecutionPlan(input: {
  taskId: string;
  featureId: string;
  userId: string;
  executorId: ExecutorType;
  fallbackChain?: ExecutorType[];
  workflowId?: string;
  workflowVersion?: number;
  /** Phase 9.23：模型/LoRA/ControlNet 快照（默认值空数组） */
  models?: ModelSnapshot[];
  loras?: AssetSnapshot[];
  controlnets?: AssetSnapshot[];
  estimatedCost: number;
  inputsSnapshot: Record<string, unknown>;
}): ExecutionPlan {
  return {
    taskId: input.taskId,
    featureId: input.featureId,
    userId: input.userId,
    executorId: input.executorId,
    fallbackChain: input.fallbackChain ?? [],
    workflowId: input.workflowId,
    workflowVersion: input.workflowVersion,
    models: input.models ?? [],
    loras: input.loras ?? [],
    controlnets: input.controlnets ?? [],
    estimatedCost: input.estimatedCost,
    inputsSnapshot: input.inputsSnapshot,
    createdAt: new Date().toISOString(),
    planVersion: 1,
  };
}

/** 构建 ExecutionTrace */
export function createExecutionTrace(plan: ExecutionPlan, maxAttempts = 3): ExecutionTrace {
  return {
    taskId: plan.taskId,
    planVersion: plan.planVersion,
    attempted: [],
    attempt: 0,
    maxAttempts,
  };
}
