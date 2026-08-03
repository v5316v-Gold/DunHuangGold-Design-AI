/**
 * AI 服务 — 平面转雕塑 (stereo)
 *
 * 利用 ComfyUI 的 depthMapFromImage（带 stereoImage 输出）
 */

import { registerService } from '../register-helper';
import { checkComfyUIHealth, depthMapFromImage } from '@/lib/comfyui-service';
import { createLogger } from '@/lib/error-handler';
import type { GenerationRequest, GenerationResult } from '../types';

const logger = createLogger('service:stereo');

registerService({
  type: 'stereo',
  label: '平面转雕塑',
  powerCost: 25,
  requiresImage: true,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    if (!req.image) {
      return { success: false, error: '平面转雕塑需要参考图片', provider: 'comfyui' };
    }

    logger.info('[stereo] 开始平面转雕塑');

    if (await checkComfyUIHealth()) {
      const result = await depthMapFromImage(req.image, { style: 'realistic' });
      if (result.success && result.stereoImage) {
        return {
          success: true,
          data: result.stereoImage,
          provider: 'comfyui',
          workflow: 'depth-map-stereo',
        };
      }
      logger.warn('[stereo] ComfyUI 失败');
    }

    return { success: false, error: 'ComfyUI 不可用', provider: 'comfyui' };
  },
});