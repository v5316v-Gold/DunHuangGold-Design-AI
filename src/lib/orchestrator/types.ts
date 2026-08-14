// Phase 9.23 · Workflow Asset Closure：增加 hermes（AI 对话）+ third-party（Cloud/fallback）
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
