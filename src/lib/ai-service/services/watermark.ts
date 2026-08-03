/**
 * AI 服务 — 去除水印 (watermark)
 */

import { registerService } from '../register-helper';
import { checkComfyUIHealth, removeWatermark } from '@/lib/comfyui-service';
import { createLogger } from '@/lib/error-handler';
import type { GenerationRequest, GenerationResult } from '../types';

const logger = createLogger('service:watermark');

registerService({
  type: 'watermark',
  label: '去除水印',
  powerCost: 5,
  requiresImage: true,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const { image } = req;
    if (!image) return { success: false, error: '需要图片', provider: 'comfyui' };

    logger.info('[watermark] 开始去水印');

    if (await checkComfyUIHealth()) {
      const result = await removeWatermark(image);
      if (result.success && result.images?.length) {
        return {
          success: true,
          data: result.images[0],
          provider: 'comfyui',
          workflow: 'remove-watermark',
        };
      }
      logger.warn('[watermark] ComfyUI 失败，由 pipeline 走云端兜底');
    }

    return { success: false, error: 'ComfyUI 不可用', provider: 'comfyui' };
  },
});