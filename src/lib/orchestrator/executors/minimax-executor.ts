/**
 * Phase 9.20 · Minimax Executor（Port 适配器）
 *
 * 实现 Executor Port 接口，委托给 minimax-feature-adapter
 * 作为 ThirdPartyExecutor 的实际实现（替换之前的占位）
 *
 * 角色：
 *   - primary executor: text2img / text2video / img2video / dialogue / ai_assistant
 *   - NOT_SUPPORTED: image3d / relief / refine / blend / removebg / upscale /
 *                    watermark / sketch / stereo / multiview / oneclick / free / tryon
 *     （这些降级为 NOT_SUPPORTED 让 ComfyUI 兜底）
 */

import type { Executor, ExecutorRequest, ExecutorResult } from '@/lib/ai/ports/executor.port';
import { executeMinimax, hasMinimaxHandler, MINIMAX_SUPPORTED_FEATURES } from '@/lib/minimax-feature-adapter';
import { checkMinimaxHealth } from '@/lib/minimax-call-service';

/**
 * MinimaxExecutor：作为 ThirdParty Executor 的实现
 */
export class MinimaxExecutor implements Executor {
  readonly type = 'third-party' as const;
  readonly id = 'third-party' as const;
  readonly productionSafe = true;

  /**
   * 声明 Minimax 真实支持的功能
   * （包括 NOT_SUPPORTED 的功能，让 fallback 链走到 ComfyUI）
   */
  capabilities(): Set<string> {
    // 返回全集：所有 17 个功能 Minimax 都会"接"（但仅 5 个真支持）
    return new Set([
      'text2img', 'text2video', 'img2video', 'dialogue', 'ai_assistant',
      'refine', 'blend', 'removebg', 'upscale', 'watermark',
      'sketch', 'stereo', 'multiview', 'oneclick', 'free', 'tryon',
      'image3d', 'relief',
    ]);
  }

  /**
   * 健康检查（调 /v1/models）
   */
  async isAvailable(): Promise<boolean> {
    return checkMinimaxHealth();
  }

  /**
   * 执行（委托给 feature-adapter）
   */
  async execute(req: ExecutorRequest): Promise<ExecutorResult> {
    if (!hasMinimaxHandler(req.featureId)) {
      return {
        success: false,
        executorUsed: this.id,
        error: {
          code: 'NOT_SUPPORTED',
          message: `Minimax 不支持 ${req.featureId}`,
          retryable: true,
        },
        cost: 0,
        latencyMs: 0,
        traceId: req.traceId,
      };
    }
    return executeMinimax(req);
  }
}

/**
 * 实际支持的功能列表（仅 5 个真可用）
 */
export { MINIMAX_SUPPORTED_FEATURES };
