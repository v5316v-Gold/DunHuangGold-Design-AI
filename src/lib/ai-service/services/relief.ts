/**
 * AI 服务 — 浮雕设计 (relief)
 *
 * ComfyUI 浮雕效果 → Meshy API → Minimax
 */

import { registry } from '../service-registry';
import type { GenerationRequest, GenerationResult } from '../types';
import { reliefEffect, checkComfyUIHealth } from '@/lib/comfyui-service';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('service:relief');

// 深度等级 prompt 映射
const DEPTH_LEVELS: Record<string, { prompt: string; depth: number }> = {
  light: {
    prompt: 'subtle relief, gentle emboss, shallow depth, delicate texture',
    depth: 0.3,
  },
  medium: {
    prompt: 'medium relief, balanced emboss, moderate depth, clear texture',
    depth: 0.6,
  },
  deep: {
    prompt: 'deep relief, strong emboss, high depth, bold texture, sculptural',
    depth: 0.9,
  },
};

registry.register({
  type: 'relief',
  label: '浮雕设计',
  powerCost: 20,
  requiresImage: true,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const { image, depthLevel = 'medium', prompt } = req;

    if (!image) {
      return { success: false, error: '浮雕设计需要提供参考图片', provider: 'comfyui' };
    }

    const level = DEPTH_LEVELS[depthLevel as string] || DEPTH_LEVELS.medium;
    const fullPrompt = prompt
      ? `${prompt}, ${level.prompt}`
      : `relief carving, ${level.prompt}`;

    logger.info('[relief] 开始浮雕生成', { depthLevel, hasImage: !!image });

    // 优先 ComfyUI
    const comfyuiAvailable = await checkComfyUIHealth();

    if (comfyuiAvailable) {
      const result = await reliefEffect(image);

      if (result.success && result.images?.length) {
        return {
          success: true,
          data: result.images[0],
          provider: 'comfyui',
          workflow: 'relief-effect',
        };
      }

      logger.warn('[relief] ComfyUI 失败，尝试 Meshy');
    }

    // 兜底 Meshy（3D 浮雕）
    const meshyResult = await callMeshy(image, fullPrompt);
    if (meshyResult.success) return meshyResult;

    // 最后的兜底 Minimax
    return callMinimax(image, fullPrompt);
  },
});

// ============================================================
// Meshy 兜底
// ============================================================
async function callMeshy(imageUrl: string, prompt: string): Promise<GenerationResult> {
  try {
    const config = await import('@/lib/api-config-service').then(m =>
      m.getApiConfig('meshy-3d')
    );
    const apiKey = config?.apiKey || process.env.MESHY_API_KEY;

    if (!apiKey) {
      return { success: false, error: 'Meshy API 未配置', provider: 'meshy' };
    }

    const response = await fetch('https://api.meshy.ai/v1/image-to-3d', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt,
        art_style: 'sculpture',
      }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Meshy API 错误 (${response.status})`,
        provider: 'meshy',
      };
    }

    const data = await response.json();
    return {
      success: true,
      data: data.model_url || data.preview_url,
      provider: 'meshy',
      workflow: 'Meshy image-to-3d',
    };
  } catch (error) {
    logger.error('[relief] Meshy 调用失败', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Meshy 调用失败',
      provider: 'meshy',
    };
  }
}

// ============================================================
// Minimax 兜底
// ============================================================
async function callMinimax(imageUrl: string, prompt: string): Promise<GenerationResult> {
  try {
    const config = await import('@/lib/api-config-service').then(m =>
      m.getApiConfig('image-generate')
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
        prompt: `relief sculpture style: ${prompt}`,
        image_file: imageUrl,
        aspect_ratio: '1:1',
        num_images: 1,
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
    logger.error('[relief] Minimax 调用失败', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Minimax 调用失败',
      provider: 'minimax',
    };
  }
}
