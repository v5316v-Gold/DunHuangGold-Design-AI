import type { Executor, FeatureExecutionRequest, FeatureExecutionResult } from '../types';
import { FEATURE_LIST } from '@/config/features';
import { callComfyUI } from '@/lib/comfyui-call-service';
export class ComfyUIExecutor implements Executor {
  readonly type = 'comfyui' as const;
  readonly id = 'comfyui-local';
  capabilities() {
    return new Set(FEATURE_LIST.map((feature) => feature.id));
  }
  async execute(req: FeatureExecutionRequest): Promise<FeatureExecutionResult> {
    const started = Date.now();
    const result = await callComfyUI({
      featureId: req.featureId,
      ...(req.inputs as Record<string, unknown>),
    });
    if (!result.success)
      return {
        success: false,
        executorUsed: this.type,
        provider: this.id,
        error: {
          code: 'COMFYUI_FAILED',
          message: result.error || 'ComfyUI 执行失败',
          retryable: true,
        },
        cost: 0,
        latencyMs: Date.now() - started,
        traceId: req.traceId,
      };
    return {
      success: true,
      executorUsed: this.type,
      provider: this.id,
      artifacts: (result.images || []).map((url) => ({ url, mime: 'image/*' })),
      cost: 0,
      latencyMs: Date.now() - started,
      traceId: req.traceId,
    };
  }
}
