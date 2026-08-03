/**
 * AI 服务 — 图转3D (image3d)
 *
 * ComfyUI 图生 3D → Meshy image-to-3d
 */

import { registerService } from '../register-helper';
import { checkComfyUIHealth, imageTo3D } from '@/lib/comfyui-service';
import { createLogger } from '@/lib/error-handler';
import type { GenerationRequest, GenerationResult } from '../types';

const logger = createLogger('service:image3d');

registerService({
  type: 'image3d',
  label: '图转3D',
  powerCost: 30,
  requiresImage: true,
  primaryProvider: 'comfyui',
  cloudProvider: 'meshy',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const { image, prompt = '' } = req;
    if (!image) return { success: false, error: '图转3D需要图片', provider: 'comfyui' };

    logger.info('[image3d] 开始生成 3D', { hasImage: !!image });

    if (await checkComfyUIHealth()) {
      const result = await imageTo3D(image);
      if (result.success && (result.modelUrl || result.modelUrls?.length)) {
        return {
          success: true,
          data: result.modelUrl || result.modelUrls![0],
          provider: 'comfyui',
          workflow: 'image-to-3d',
        };
      }
      logger.warn('[image3d] ComfyUI 失败，由 pipeline 走云端兜底');
    }

    return { success: false, error: 'ComfyUI 不可用', provider: 'comfyui' };
  },
});