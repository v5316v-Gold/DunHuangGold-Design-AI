/**
 * AI 服务 — 图生视频 (img2video)
 *
 * ⚠️ 当前不可行：海外 Kling API 防火墙拦截，国内 Minimax 无视频模型
 * 待替代方案：阿里云通义万相视频 / 字节豆包视频 / 即梦
 */

import { registerService } from '../register-helper';
import type { GenerationRequest, GenerationResult } from '../types';

registerService({
  type: 'img2video',
  label: '图生视频',
  powerCost: 40,
  requiresImage: true,
  primaryProvider: 'comfyui',
  cloudProvider: 'kling',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    if (!req.image) {
      return { success: false, error: '图生视频需要参考图片', provider: 'kling' };
    }
    return {
      success: false,
      error: 'img2video 服务暂不可用：海外 Kling API 被防火墙拦截，国内 Minimax 无视频模型。需要接入阿里云通义万相 或 字节豆包。',
      provider: 'kling',
    };
  },
});