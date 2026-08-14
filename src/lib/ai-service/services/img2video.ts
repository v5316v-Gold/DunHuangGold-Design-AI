/**
 * AI 服务 — 图生视频 (img2video)
 *
 * Phase 9.19 重构：视频服务标识为 minimax（按用户决定）。
 * ⚠️ 实际状态：当前国内 Minmax 无视频模型，海外 Kling 防火墙拦截；
 * 如需真实视频生成，需接入通义万相/豆包/MiniMax 海外/可灵海外 等。
 */

import { registerService } from '../register-helper';
import type { GenerationRequest, GenerationResult } from '../types';

registerService({
  type: 'img2video',
  label: '图生视频',
  powerCost: 40,
  requiresImage: true,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    if (!req.image) {
      return { success: false, error: '图生视频需要参考图片', provider: 'minimax' };
    }
    return {
      success: false,
      error: 'img2video 服务暂不可用：Minmax 国内无视频模型，海外 Kling 防火墙拦截。如需真实视频生成，需接入通义万相/豆包/MiniMax 海外/可灵海外 等。',
      provider: 'minimax',
    };
  },
});
