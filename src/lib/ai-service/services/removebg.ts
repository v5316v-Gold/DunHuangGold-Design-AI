/**
 * AI 服务 — 移除背景 (removebg)
 */

import { registerService } from '../register-helper';
import { checkComfyUIHealth, removeBackground } from '@/lib/comfyui-service';
import { createLogger } from '@/lib/error-handler';
import type { GenerationRequest, GenerationResult } from '../types';

const logger = createLogger('service:removebg');

registerService({
  type: 'removebg',
  label: '移除背景',
  powerCost: 5,
  requiresImage: true,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const { image } = req;
    if (!image) return { success: false, error: '需要图片', provider: 'comfyui' };

    logger.info('[removebg] 开始移除背景');

    if (await checkComfyUIHealth()) {
      const result = await removeBackground(image);
      if (result.success && result.images?.length) {
        return {
          success: true,
          data: result.images[0],
          provider: 'comfyui',
          workflow: 'remove-background',
        };
      }
      logger.warn('[removebg] ComfyUI 失败，由 pipeline 走云端兜底');
    }

    return { success: false, error: 'ComfyUI 不可用', provider: 'comfyui' };
  },
});