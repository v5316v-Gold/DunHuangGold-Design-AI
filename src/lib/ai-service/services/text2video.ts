/**
 * AI 服务 — 文生视频 (text2video)
 *
 * ⚠️ 当前不可行：海外 Kling API 防火墙拦截，国内 Minimax 无视频模型
 * 待替代方案：阿里云通义万相视频 / 字节豆包视频 / 即梦
 */

import { registerService } from '../register-helper';
import type { GenerationRequest, GenerationResult } from '../types';

registerService({
  type: 'text2video',
  label: '文生视频',
  powerCost: 50,
  requiresImage: false,
  primaryProvider: 'comfyui',
  cloudProvider: 'kling',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    return {
      success: false,
      error: 'text2video 服务暂不可用：海外 Kling API 被防火墙拦截，国内 Minimax 无视频模型。需要接入阿里云通义万相 或 字节豆包。',
      provider: 'kling',
    };
  },
});