/**
 * AI 服务 — 高清放大 (upscale)
 */

import { registerService } from '../register-helper';
import { checkComfyUIHealth, upscaleImage } from '@/lib/comfyui-service';
import { createLogger } from '@/lib/error-handler';
import type { GenerationRequest, GenerationResult } from '../types';

const logger = createLogger('service:upscale');

registerService({
  type: 'upscale',
  label: '高清放大',
  powerCost: 5,
  requiresImage: true,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const { image, scale = 2 } = req;
    if (!image) return { success: false, error: '需要图片', provider: 'comfyui' };

    logger.info('[upscale] 开始放大', { scale });

    if (await checkComfyUIHealth()) {
      const result = await upscaleImage(image, Number(scale));
      if (result.success && result.images?.length) {
        return {
          success: true,
          data: result.images[0],
          provider: 'comfyui',
          workflow: 'upscale',
        };
      }
      logger.warn('[upscale] ComfyUI 失败，由 pipeline 走云端兜底');
    }

    return { success: false, error: 'ComfyUI 不可用', provider: 'comfyui' };
  },
});