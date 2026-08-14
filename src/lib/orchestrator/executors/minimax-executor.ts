/**
 * MinimaxExecutor = CloudExecutor（Phase 9.23 · Workflow Asset Closure 收编）
 *
 * 角色：fallback / 特殊能力 provider，仅当主执行器 ComfyUI 不可用时启用
 * 真实支持功能：text2img / text2video / img2video / dialogue / ai_assistant（5 个）
 *
 * 注意：type/id 保留为 'third-party'（已部署路由/audit/seed 一致性），
 *       但 class 名语义改为 Cloud（fallback 专用）
 */
import type { Executor, ExecutorRequest, ExecutorResult } from '@/lib/ai/ports/executor.port';
import { executeMinimax, hasMinimaxHandler, MINIMAX_SUPPORTED_FEATURES } from '@/lib/minimax-feature-adapter';
import { checkMinimaxHealth } from '@/lib/minimax-call-service';

export class MinimaxExecutor implements Executor {
  readonly type = 'third-party' as const;
  readonly id = 'third-party' as const;
  readonly productionSafe = true;

  /**
   * 仅声明 5 个真支持功能（其它功能直接 NOT_SUPPORTED → 路由跳出 fallback）
   * Phase 9.23 收口变更：capabilities 从 17 全集收窄为 5 真支持集
   */
  capabilities(): Set<string> {
    return new Set(MINIMAX_SUPPORTED_FEATURES);
  }

  async isAvailable(): Promise<boolean> {
    return checkMinimaxHealth();
  }

  async execute(req: ExecutorRequest): Promise<ExecutorResult> {
    if (!hasMinimaxHandler(req.featureId)) {
      return {
        success: false,
        executorUsed: this.id,
        error: {
          code: 'NOT_SUPPORTED',
          message: `Minimax (Cloud fallback) 不支持 ${req.featureId}`,
          retryable: false,
        },
        cost: 0,
        latencyMs: 0,
        traceId: req.traceId,
      };
    }
    return executeMinimax(req);
  }
}

/** Minimax 真支持的功能集合（导出供测试 + 路由策略使用） */
export { MINIMAX_SUPPORTED_FEATURES };