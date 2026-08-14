/**
 * AI 服务 — 文生视频 (text2video)
 *
 * Phase 9.19 重构：视频服务标识为 minimax（按用户决定）。
 * ⚠️ 实际状态：当前国内 Minmax 无视频模型，海外 Kling 防火墙拦截；
 * 如需真实视频生成，需接入通义万相/豆包/MiniMax 海外/可灵海外 等。
 */

import { registerService } from '../register-helper';
import type { GenerationRequest, GenerationResult } from '../types';

registerService({
  type: 'text2video',
  label: '文生视频',
  powerCost: 50,
  requiresImage: false,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    return {
      success: false,
      error: 'text2video 服务暂不可用：Minmax 国内无视频模型，海外 Kling 防火墙拦截。如需真实视频生成，需接入通义万相/豆包/MiniMax 海外/可灵海外 等。',
      provider: 'minimax',
    };
  },
});
