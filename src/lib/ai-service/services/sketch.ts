/**
 * AI 服务 — 线稿写实 (sketch)
 *
 * ComfyUI sketch → real 图片转换
 */

import { registerService } from '../register-helper';
import { checkComfyUIHealth, sketchToRealistic } from '@/lib/comfyui-service';
import { createLogger } from '@/lib/error-handler';
import type { GenerationRequest, GenerationResult } from '../types';

const logger = createLogger('service:sketch');

registerService({
  type: 'sketch',
  label: '线稿写实',
  powerCost: 15,
  requiresImage: true,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const { image, prompt = '' } = req;

    if (!image) {
      return { success: false, error: '线稿写实需要提供图片', provider: 'comfyui' };
    }

    logger.info('[sketch] 开始线稿转写实', { hasImage: !!image });

    if (await checkComfyUIHealth()) {
      const result = await sketchToRealistic(image);
      if (result.success && result.images?.length) {
        return {
          success: true,
          data: result.images[0],
          provider: 'comfyui',
          workflow: 'sketch-to-realistic',
        };
      }
      logger.warn('[sketch] ComfyUI 失败，由 pipeline 走云端兜底');
    }

    return {
      success: false,
      error: 'ComfyUI 不可用或生成失败',
      provider: 'comfyui',
    };
  },
});