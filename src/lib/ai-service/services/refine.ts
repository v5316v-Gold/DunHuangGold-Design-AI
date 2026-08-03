/**
 * AI 服务 — 产品精修 (refine)
 *
 * ComfyUI img2img → Minimax img2img → mock
 */

import { registry } from '../service-registry';
import type { GenerationRequest, GenerationResult } from '../types';
import { refineImage, checkComfyUIHealth } from '@/lib/comfyui-service';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('service:refine');

// 增强风格
const ENHANCEMENT_PROMPTS: Record<string, string> = {
  professional: 'professional product photography, high detail, commercial grade, soft lighting, white background',
  luxury: 'luxury texture, golden accents, jewelry-level refinement, brilliant light and shadow',
  creative: 'creative product display, artistic composition, unique lighting, fashionable',
  minimal: 'minimalist style, clean background, soft shadows, Nordic design',
};

registry.register({
  type: 'refine',
  label: '产品精修',
  powerCost: 15,
  requiresImage: true,  // 需要图片输入
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const { image, prompt, enhancement = 'professional' } = req;

    if (!image) {
      return { success: false, error: '产品精修需要提供参考图片', provider: 'comfyui' };
    }

    // 构建完整 prompt
    const stylePrompt = ENHANCEMENT_PROMPTS[enhancement as string] || ENHANCEMENT_PROMPTS.professional;
    const fullPrompt = prompt
      ? `${prompt}, ${stylePrompt}`
      : `product refinement, ${stylePrompt}`;

    logger.info('[refine] 开始精修', { enhancement, hasImage: !!image });

    // 优先 ComfyUI
    const comfyuiAvailable = await checkComfyUIHealth();

    if (comfyuiAvailable) {
      const result = await refineImage(image);

      if (result.success && result.images?.length) {
        return {
          success: true,
          data: result.images[0],
          provider: 'comfyui',
          workflow: 'img2img (KSampler)',
        };
      }

      logger.warn('[refine] ComfyUI 失败，尝试 Minimax');
    }

    // 兜底 Minimax
    return await callMinimax(image, fullPrompt);
  },
});

// ============================================================
// Minimax 兜底
// ============================================================
async function callMinimax(
  imageUrl: string,
  prompt: string
): Promise<GenerationResult> {
  try {
    const config = await import('@/lib/api-config-service').then(m =>
      m.getApiConfig('product-refine')
    );
    const apiKey = config?.apiKey || process.env.MINIMAX_API_KEY;

    if (!apiKey) {
      return { success: false, error: 'Minimax API 未配置', provider: 'minimax' };
    }

    const response = await fetch('https://api.minimax.chat/v1/image_generation', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'image-01',
        prompt,
        aspect_ratio: '1:1',
        num_images: 1,
        image_file: imageUrl,
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Minimax API 错误 (${response.status})`,
        provider: 'minimax',
      };
    }

    const data = await response.json();
    const imageUrls: string[] = data.data?.image_urls || [];

    if (!imageUrls.length) {
      return { success: false, error: 'Minimax 未返回图片', provider: 'minimax' };
    }

    return { success: true, data: imageUrls[0], provider: 'minimax' };
  } catch (error) {
    logger.error('[refine] Minimax 调用失败', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Minimax 调用失败',
      provider: 'minimax',
    };
  }
}
