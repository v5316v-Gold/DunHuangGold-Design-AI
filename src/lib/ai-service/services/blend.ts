/**
 * AI 服务 — 多图融合 (blend)
 *
 * ComfyUI 多图混合
 */

import { registerService } from '../register-helper';
import { checkComfyUIHealth, blendImages } from '@/lib/comfyui-service';
import { createLogger } from '@/lib/error-handler';
import type { GenerationRequest, GenerationResult } from '../types';

const logger = createLogger('service:blend');

registerService({
  type: 'blend',
  label: '多图融合',
  powerCost: 15,
  requiresImage: true,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const { images, blendMode = 'normal' } = req;

    if (!images?.length) {
      return { success: false, error: '多图融合需要至少一张图片', provider: 'comfyui' };
    }

    logger.info('[blend] 开始融合', { count: images.length, mode: blendMode });

    if (await checkComfyUIHealth()) {
      const result = await blendImages(images, String(blendMode));
      if (result.success && result.images?.length) {
        return {
          success: true,
          data: result.images[0],
          provider: 'comfyui',
          workflow: 'blend-images',
        };
      }
      logger.warn('[blend] ComfyUI 失败，由 pipeline 走云端兜底');
    }

    return {
      success: false,
      error: 'ComfyUI 不可用或生成失败',
      provider: 'comfyui',
    };
  },
});