/**
 * AI 服务 — 文生图 (text2img)
 *
 * 优先级：ComfyUI Z-Image-Turbo → SD1.5 → Minimax
 */

import { registry, parseImageSize, normalizeCount } from '../service-registry';
import type { GenerationRequest, GenerationResult } from '../types';
import { textToImage, textToImageZTurbo, checkComfyUIHealth } from '@/lib/comfyui-service';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('service:text2img');

registry.register({
  type: 'text2img',
  label: '文生图',
  powerCost: 10,
  requiresImage: false,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const { width = 512, height = 512, count = 1, prompt = '' } = req;
    const size = parseImageSize(req.resolution, req.ratio);
    const finalWidth = width || size.width;
    const finalHeight = height || size.height;
    const finalCount = normalizeCount(count);

    logger.info('[text2img] 开始生成', { prompt: prompt.substring(0, 50), size: `${finalWidth}x${finalHeight}` });

    // 优先 ComfyUI
    const comfyuiAvailable = await checkComfyUIHealth();

    if (comfyuiAvailable) {
      // 同步模式
      const result = await textToImageZTurbo({
        prompt,
        width: finalWidth,
        height: finalHeight,
        count: finalCount,
      });

      if (result.success && result.images?.length) {
        return {
          success: true,
          data: result.images,
          provider: 'comfyui',
          workflow: 'Z-Image-Turbo',
        };
      }

      // Z-Turbo 失败，尝试 SD1.5
      logger.warn('[text2img] Z-Turbo 失败，尝试 SD1.5');
      const sdResult = await textToImage({
        prompt,
        width: finalWidth,
        height: finalHeight,
        count: finalCount,
      });

      if (sdResult.success && sdResult.images?.length) {
        return {
          success: true,
          data: sdResult.images,
          provider: 'comfyui',
          workflow: 'SD1.5',
        };
      }

      return {
        success: false,
        error: result.error || 'ComfyUI 生成失败',
        provider: 'comfyui',
      };
    }

    // ComfyUI 不可用，由 pipeline 执行云端兜底
    return {
      success: false,
      error: 'ComfyUI 不可用',
      provider: 'comfyui',
    };
  },
});
