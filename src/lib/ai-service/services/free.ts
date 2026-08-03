/**
 * AI 服务 — 自由创作 (free)
 *
 * 开放模式：用户输入任何 prompt → Minimax 文生图
 * 比 oneclick 更自由，无 prompt 模板
 */

import { registerService } from '../register-helper';
import { createLogger } from '@/lib/error-handler';
import type { GenerationRequest, GenerationResult } from '../types';

const logger = createLogger('service:free');

const MINIMAX_API_BASE = process.env.MINIMAX_API_BASE || 'https://api.minimax.chat/v1';
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';

async function freeGenerate(prompt: string, width = 1024, height = 1024): Promise<string | null> {
  if (!MINIMAX_API_KEY) throw new Error('MINIMAX_API_KEY 未配置');

  const response = await fetch(`${MINIMAX_API_BASE}/image_generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MINIMAX_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'image-01',
      prompt,
      aspect_ratio: width === height ? '1:1' : (width > height ? '16:9' : '9:16'),
      num_images: 1,
    }),
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.data?.image_urls?.[0] || null;
}

registerService({
  type: 'free',
  label: '自由创作',
  powerCost: 15,
  requiresImage: false,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const prompt = (req.prompt as string) || '';
    if (!prompt) {
      return { success: false, error: '自由创作需要 prompt', provider: 'minimax' };
    }

    const width = (req.width as number) || 1024;
    const height = (req.height as number) || 1024;

    logger.info('[free] 开始自由创作', { prompt: prompt.substring(0, 50) });

    try {
      const imageUrl = await freeGenerate(prompt, width, height);
      if (imageUrl) {
        return {
          success: true,
          data: imageUrl,
          provider: 'minimax',
          workflow: 'free-generation',
        };
      }
    } catch (err) {
      logger.error('[free] 失败', err);
    }

    return {
      success: false,
      error: '自由创作失败',
      provider: 'minimax',
    };
  },
});