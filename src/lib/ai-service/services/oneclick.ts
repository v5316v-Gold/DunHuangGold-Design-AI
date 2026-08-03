/**
 * AI 服务 — 一键设计 (oneclick)
 *
 * 简化的端到端设计：用户给一句描述 → 输出设计图
 * 内部组合：prompt 优化 + Minimax 文生图
 */

import { registerService } from '../register-helper';
import { createLogger } from '@/lib/error-handler';
import type { GenerationRequest, GenerationResult } from '../types';

const logger = createLogger('service:oneclick');

const MINIMAX_API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimax.chat/v1';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';

async function oneClickDesign(prompt: string): Promise<string | null> {
  if (!MINIMAX_API_KEY) throw new Error('MINIMAX_API_KEY 未配置');

  // 拼装"一键设计"专用 prompt
  const fullPrompt = `${prompt}, professional jewelry design, gold material, exquisite craftsmanship, dramatic lighting, 3D render, white background, high detail`;

  const response = await fetch(`${MINIMAX_API_BASE}/image_generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'image-01',
      prompt: fullPrompt,
      aspect_ratio: '1:1',
      num_images: 1,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.data?.image_urls?.[0] || null;
}

registerService({
  type: 'oneclick',
  label: '一键设计',
  powerCost: 15,
  requiresImage: false,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const prompt = (req.prompt as string) || '';
    if (!prompt) {
      return { success: false, error: '一键设计需要设计描述', provider: 'minimax' };
    }

    logger.info('[oneclick] 开始一键设计', { prompt: prompt.substring(0, 50) });

    try {
      const imageUrl = await oneClickDesign(prompt);
      if (imageUrl) {
        return {
          success: true,
          data: imageUrl,
          provider: 'minimax',
          workflow: 'oneclick-design',
        };
      }
    } catch (err) {
      logger.error('[oneclick] 失败', err);
    }

    return {
      success: false,
      error: '一键设计失败',
      provider: 'minimax',
    };
  },
});