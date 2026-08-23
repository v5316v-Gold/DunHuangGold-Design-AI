/**
 * Phase 9.23 · Workflow Asset Closure：增加 hermes（AI 对话）+ third-party（Cloud/fallback）
 *
 * O9 合并双 orchestrator：本文件保留作为兼容层，新 Port（@/lib/ai/ports/executor.port）
 * 是 Hexagonal 架构的权威接口。新 Port 的 ExecutorRequest/ExecutorResult/Executor 已
 * 满足所有老 executor 的需要，但 4 个老 executor（comfyui/minimax/hermes/mock）暂时仍
 * 用老 FeatureExecutionRequest/Result 作为方法签名以最小化 O9 改动量。后续可逐个迁移。
 */
export type ExecutorType = 'mock' | 'comfyui' | 'third-party' | 'hermes';
export interface FeatureExecutionRequest {
  featureId: string;
  userId: string;
  inputs: Record<string, unknown>;
  traceId: string;
  _feature?: unknown;
}
export interface FeatureExecutionResult {
  success: boolean;
  artifacts?: Array<{
    url: string;
    mime: string;
    sha256?: string;
    metadata?: Record<string, unknown>;
  }>;
  error?: { code: string; message: string; retryable: boolean };
  executorUsed: ExecutorType;
  provider?: string;
  cost: number;
  latencyMs: number;
  traceId: string;
}
export interface Executor {
  readonly type: ExecutorType;
  readonly id: string;
  capabilities(): Set<string>;
  execute(req: FeatureExecutionRequest): Promise<FeatureExecutionResult>;
}
