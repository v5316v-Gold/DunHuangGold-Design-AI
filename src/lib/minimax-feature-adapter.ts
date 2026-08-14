/**
 * Phase 9.20 · Minimax Feature Adapter
 *
 * 把 features 表的 17 个功能 ID 映射到 minimax 函数调用
 * 与 ComfyUIExecutor 平行，作为 ThirdPartyExecutor 的实际实现
 *
 * 17 功能 Minimax 能力映射（实测）：
 *   5 个真实可用：text2img / text2video / img2video / dialogue / ai_assistant
 *   12 个 NOT_SUPPORTED：image3d / relief / refine / blend / removebg / upscale /
 *                       watermark / sketch / stereo / multiview / oneclick / free / tryon
 *
 * 设计原则：
 *   - Minimax 无能力的功能：返回 success: false (NOT_SUPPORTED) 让 ComfyUI 兜底
 *   - Minimax 有能力的功能：直接调用，返回真实结果
 *   - 视频是异步：返回 taskId 让 worker 轮询
 */

import {
  minimaxChat,
  minimaxImageGen,
  minimaxVideoGen,
} from './minimax-call-service';
import type {
  ExecutorRequest,
  ExecutorResult,
} from '@/lib/ai/ports/executor.port';

type MinimaxHandler = (req: ExecutorRequest) => Promise<ExecutorResult>;

const NOT_SUPPORTED = (
  req: ExecutorRequest,
  feature: string
): ExecutorResult => ({
  success: false,
  executorUsed: 'third-party',
  error: {
    code: 'NOT_SUPPORTED',
    message: `Minimax 不支持 ${feature}，请用 ComfyUI`,
    retryable: true,
  },
  cost: 0,
  latencyMs: 0,
  traceId: req.traceId,
});

/**
 * 把 minimax 输出结果适配为 ExecutorResult
 */
function toExecutorResult(
  req: ExecutorRequest,
  result: { success: boolean; data?: { image_urls?: string[] }; error?: string; requestId?: string },
  mime = 'image/jpeg'
): ExecutorResult {
  if (!result.success) {
    return {
      success: false,
      executorUsed: 'third-party',
      error: {
        code: 'MINIMAX_FAILED',
        message: result.error || 'unknown',
        retryable: true,
      },
      cost: 0,
      latencyMs: 0,
      traceId: req.traceId,
    };
  }
  return {
    success: true,
    artifacts: (result.data?.image_urls || []).map((u) => ({ url: u, mime })),
    executorUsed: 'third-party',
    provider: 'minimax',
    cost: 0,
    latencyMs: 0,
    traceId: req.traceId,
  };
}

const HANDLERS: Record<string, MinimaxHandler> = {
  // ====== 真实可用 5 个 ======
  text2img: async (req) => {
    const prompt = String(req.inputs.prompt || '');
    if (!prompt) return NOT_SUPPORTED(req, 'text2img (无 prompt)');
    const r = await minimaxImageGen({
      prompt,
      userId: req.userId,
      featureId: req.featureId,
    });
    return toExecutorResult(req, r);
  },

  text2video: async (req) => {
    const prompt = String(req.inputs.prompt || '');
    if (!prompt) return NOT_SUPPORTED(req, 'text2video (无 prompt)');
    const r = await minimaxVideoGen({
      prompt,
      userId: req.userId,
      featureId: req.featureId,
    });
    if (!r.success || !r.data) {
      return {
        success: false,
        executorUsed: 'third-party',
        error: { code: 'MINIMAX_FAILED', message: r.error || 'unknown', retryable: true },
        cost: 0,
        latencyMs: 0,
        traceId: req.traceId,
      };
    }
    // 视频是异步：返回 taskId（前端/worker 轮询用）
    return {
      success: true,
      artifacts: [
        { url: `minimax://task/${r.data.taskId}`, mime: 'video/pending' },
      ],
      executorUsed: 'third-party',
      provider: 'minimax',
      cost: 0,
      latencyMs: 0,
      traceId: req.traceId,
      raw: { taskId: r.data.taskId, status: 'pending' },
    };
  },

  img2video: async (req) => {
    const prompt = String(req.inputs.prompt || '');
    const imageUrl =
      (req.inputs.image as string) || (req.inputs.imageUrl as string) || '';
    if (!prompt || !imageUrl) return NOT_SUPPORTED(req, 'img2video (缺 prompt/image)');
    const r = await minimaxVideoGen({
      prompt,
      imageUrl,
      userId: req.userId,
      featureId: req.featureId,
    });
    if (!r.success || !r.data) {
      return {
        success: false,
        executorUsed: 'third-party',
        error: { code: 'MINIMAX_FAILED', message: r.error || 'unknown', retryable: true },
        cost: 0,
        latencyMs: 0,
        traceId: req.traceId,
      };
    }
    return {
      success: true,
      artifacts: [
        { url: `minimax://task/${r.data.taskId}`, mime: 'video/pending' },
      ],
      executorUsed: 'third-party',
      provider: 'minimax',
      cost: 0,
      latencyMs: 0,
      traceId: req.traceId,
      raw: { taskId: r.data.taskId, status: 'pending' },
    };
  },

  dialogue: async (req) => {
    const messages =
      (req.inputs.messages as Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }>) || [
        { role: 'system', content: '你是敦煌金 AI 设计平台的助手，专注于珠宝设计。' },
        { role: 'user', content: String(req.inputs.prompt || '') },
      ];
    const r = await minimaxChat({
      messages,
      userId: req.userId,
      featureId: req.featureId,
    });
    if (!r.success || !r.data) {
      return {
        success: false,
        executorUsed: 'third-party',
        error: { code: 'MINIMAX_FAILED', message: r.error || 'unknown', retryable: true },
        cost: 0,
        latencyMs: 0,
        traceId: req.traceId,
      };
    }
    return {
      success: true,
      artifacts: [
        { url: `data:text/plain,${encodeURIComponent(r.data.content)}`, mime: 'text/plain' },
      ],
      executorUsed: 'third-party',
      provider: 'minimax',
      cost: 0,
      latencyMs: 0,
      traceId: req.traceId,
    };
  },

  ai_assistant: async (req) => {
    const messages =
      (req.inputs.messages as Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
      }>) || [
        { role: 'system', content: '你是敦煌金 AI 设计平台的珠宝设计师助手。' },
        { role: 'user', content: String(req.inputs.prompt || '') },
      ];
    const r = await minimaxChat({
      messages,
      userId: req.userId,
      featureId: req.featureId,
    });
    if (!r.success || !r.data) {
      return {
        success: false,
        executorUsed: 'third-party',
        error: { code: 'MINIMAX_FAILED', message: r.error || 'unknown', retryable: true },
        cost: 0,
        latencyMs: 0,
        traceId: req.traceId,
      };
    }
    return {
      success: true,
      artifacts: [
        { url: `data:text/plain,${encodeURIComponent(r.data.content)}`, mime: 'text/plain' },
      ],
      executorUsed: 'third-party',
      provider: 'minimax',
      cost: 0,
      latencyMs: 0,
      traceId: req.traceId,
    };
  },

  // ====== Minimax 无能力：返回 NOT_SUPPORTED 让 ComfyUI 兜底 ======
  // 3D 类
  image3d: (req) => Promise.resolve(NOT_SUPPORTED(req, 'image3d')),
  relief: (req) => Promise.resolve(NOT_SUPPORTED(req, 'relief')),
  // 图像处理类（Minimax 无 refine/blend/removebg/upscale/watermark）
  refine: (req) => Promise.resolve(NOT_SUPPORTED(req, 'refine')),
  blend: (req) => Promise.resolve(NOT_SUPPORTED(req, 'blend')),
  removebg: (req) => Promise.resolve(NOT_SUPPORTED(req, 'removebg')),
  upscale: (req) => Promise.resolve(NOT_SUPPORTED(req, 'upscale')),
  watermark: (req) => Promise.resolve(NOT_SUPPORTED(req, 'watermark')),
  sketch: (req) => Promise.resolve(NOT_SUPPORTED(req, 'sketch')),
  stereo: (req) => Promise.resolve(NOT_SUPPORTED(req, 'stereo')),
  // 创作类
  multiview: (req) => Promise.resolve(NOT_SUPPORTED(req, 'multiview')),
  oneclick: (req) => Promise.resolve(NOT_SUPPORTED(req, 'oneclick')),
  free: (req) => Promise.resolve(NOT_SUPPORTED(req, 'free')),
  // 试穿
  tryon: (req) => Promise.resolve(NOT_SUPPORTED(req, 'tryon')),
};

/**
 * 是否有 Minimax handler
 */
export function hasMinimaxHandler(featureId: string): boolean {
  return featureId in HANDLERS;
}

/**
 * 执行 Minimax handler
 */
export async function executeMinimax(
  req: ExecutorRequest
): Promise<ExecutorResult> {
  const handler = HANDLERS[req.featureId];
  if (!handler) {
    return {
      success: false,
      executorUsed: 'third-party',
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
  return handler(req);
}

/**
 * 列出 Minimax 真实支持的功能
 */
export const MINIMAX_SUPPORTED_FEATURES = Object.keys(HANDLERS).filter(
  (id) => !['refine', 'blend', 'removebg', 'upscale', 'watermark', 'sketch', 'stereo', 'multiview', 'oneclick', 'free', 'tryon', 'image3d', 'relief'].includes(id)
);
