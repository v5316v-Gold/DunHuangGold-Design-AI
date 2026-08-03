/**
 * AI 服务 — 多视图生成 (multiview)
 *
 * 策略：
 * - 优先 ComfyUI（如果有专门工作流）
 * - 否则用 Minimax 多张生成 + 提示词引导
 */

import { registerService } from '../register-helper';
import { createLogger } from '@/lib/error-handler';
import type { GenerationRequest, GenerationResult } from '../types';

const logger = createLogger('service:multiview');

const MINIMAX_API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimax.chat/v1';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';

/**
 * 用 Minimax 生成多视图（前后左右上下共 6 张）
 */
async function generateMultiviewMinimax(imageUrl: string): Promise<string[]> {
  if (!MINIMAX_API_KEY) throw new Error('MINIMAX_API_KEY 未配置');

  const views = ['front', 'right', 'back', 'left', 'top', 'bottom'];
  const imageUrls: string[] = [];

  // 简化：实际生产应并行请求
  for (const view of views) {
    const response = await fetch(`${MINIMAX_API_BASE}/image_generation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'image-01',
        prompt: `jewelry design, ${view} view, professional product photography, white background, consistent design with reference`,
        image_file: imageUrl,
        aspect_ratio: '1:1',
        num_images: 1,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const urls = data.data?.image_urls || [];
      if (urls[0]) imageUrls.push(urls[0]);
    }
  }
  return imageUrls;
}

registerService({
  type: 'multiview',
  label: '多视图',
  powerCost: 20,
  requiresImage: true,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    if (!req.image) {
      return { success: false, error: '多视图需要参考图片', provider: 'comfyui' };
    }

    logger.info('[multiview] 开始生成 6 视图');

    // 当前 ComfyUI 无多视图专用工作流，直接走云端
    try {
      const urls = await generateMultiviewMinimax(req.image);
      if (urls.length > 0) {
        return {
          success: true,
          data: urls,
          provider: 'minimax',
          workflow: 'multi-view-minimax',
        };
      }
    } catch (err) {
      logger.error('[multiview] Minimax 失败', err);
    }

    return {
      success: false,
      error: '多视图生成失败（需 ComfyUI 多视图工作流 或 Minimax 余额）',
      provider: 'minimax',
    };
  },
});