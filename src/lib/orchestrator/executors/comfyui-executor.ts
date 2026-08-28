/**
 * ComfyUI Executor（Phase 9.23 · Workflow Asset Closure）
 *
 * 主执行器：16 个设计类功能（本地 ComfyUI）
 * 排除：AI 对话（dialogue → HermesAgentExecutor）
 *
 * 约束：
 *  - 用户入参仅 featureId + inputs（不含 workflowId/model/lora/controlnet）
 *  - 实际 workflow/model 由 ExecutionPlan 冻结（创建时快照，运行时不变）
 */
// O9 合并双 orchestrator：types.ts 保留作为老 executor 兼容层（FeatureExecutionRequest/Result
// 与新 Port 的 ExecutorRequest/ExecutorResult 字段兼容，只缺 plan/requestId/_feature）。
// Executor 接口直接用新 Port 的（老 Executor 字段是新 Executor 的子集）。
import type { Executor } from '@/lib/ai/ports/executor.port';
import type { FeatureExecutionRequest, FeatureExecutionResult } from '../types';
import { callComfyUI, checkComfyUIHealth } from '@/lib/comfyui-call-service';

// 16 设计类功能 id（与 features 表 default_executor='comfyui' 对齐）
// 来源：scripts/seed-features.ts + 011_seed_features_workflow_binding.sql
export const COMFYUI_DESIGN_FEATURES = new Set<string>([
  'text2img', 'refine', 'relief', 'image3d', '2dto3d', 'blend',
  'oneclick', 'multiview', 'sketch', 'free',
  'text2video', 'img2video',
  'removebg', 'upscale', 'watermark', 'tryon',
]);

export class ComfyUIExecutor implements Executor {
  readonly type = 'comfyui' as const;
  readonly id = 'comfyui';
  readonly productionSafe = true;

  capabilities(): Set<string> {
    // 16 设计类（明确排除 dialogue → HermesAgentExecutor）
    return COMFYUI_DESIGN_FEATURES;
  }

  /**
   * 健康检查（2026-08-20 · P3 路由策略）
   *
   * 路由预检：PolicyOrchestrator 在执行前调用 isAvailable()，
   * ComfyUI 不可用（端口连不上 / /system_stats 返回非 200）时直接跳过，
   * 不进入 execute（节省 120s 超时 + 噪声日志），让 decideFallback 切到下一个 executor。
   *
   * 缓存：5s 内复用上次结果（避免每任务一次网络探活）
   */
  private healthCache: { at: number; online: boolean } | null = null;
  private static readonly HEALTH_TTL_MS = 5000;

  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.healthCache && now - this.healthCache.at < ComfyUIExecutor.HEALTH_TTL_MS) {
      return this.healthCache.online;
    }
    try {
      const result = await checkComfyUIHealth();
      const online = result?.online === true;
      this.healthCache = { at: now, online };
      return online;
    } catch {
      this.healthCache = { at: now, online: false };
      return false;
    }
  }

  async execute(req: FeatureExecutionRequest): Promise<FeatureExecutionResult> {
    const started = Date.now();

    // 二次拦截：能力不在 16 类内 → 立即失败（路由兜底）
    if (!COMFYUI_DESIGN_FEATURES.has(req.featureId)) {
      return {
        success: false,
        executorUsed: this.type,
        provider: this.id,
        error: {
          code: 'FEATURE_NOT_SUPPORTED',
          message: `ComfyUIExecutor 不支持功能 ${req.featureId}（16 设计类外）`,
          retryable: false,
        },
        cost: 0,
        latencyMs: Date.now() - started,
        traceId: req.traceId,
      };
    }

    const inputs = (req.inputs as Record<string, unknown>) || {};
    // 兼容：前端传 image 字段（base64），callComfyUI 期望 inputImage
    const callInputs: Record<string, unknown> = { ...inputs };
    if (inputs.image !== undefined && callInputs.inputImage === undefined) {
      callInputs.inputImage = inputs.image;
    }

    const result = await callComfyUI({
      featureId: req.featureId,
      ...callInputs,
    });
    if (!result.success) {
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
    }
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