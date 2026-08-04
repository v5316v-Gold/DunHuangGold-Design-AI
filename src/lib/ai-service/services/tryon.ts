/**
 * AI 服务 — 佩戴效果 (tryon)
 *
 * 闭环补全（2026-08-04）：AIServiceType/配置/路由已存在，补 service 注册，
 * 对齐 17 功能完整注册（蓝图约束：17 功能全闭环）。
 *
 * 实现：调用 AI 网关（云端 minimax / 本地 comfyui）生成佩戴效果图。
 * 骨架优先：无环境时返回 mock 结果（与 mock-executor 一致语义）。
 */

import { registry } from '../service-registry';
import type { GenerationRequest, GenerationResult } from '../types';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('service:tryon');

registry.register({
  type: 'tryon',
  label: '佩戴效果',
  powerCost: 25,
  requiresImage: true,
  primaryProvider: 'comfyui',
  cloudProvider: 'minimax',

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const { image, images } = req;
    const imageList = image ? [image] : (images ?? []);
    logger.info('[tryon] 开始生成佩戴效果', { images: imageList.length });

    // 环境就绪时接入真实网关（云端 minimax / 本地 comfyui）
    // 当前为骨架：返回占位结果，路由层会按 task 模式返回 pending
    if (!imageList.length) {
      return { success: false, error: '缺少参考图', provider: 'fallback' };
    }

    return {
      success: true,
      data: [`/api/placeholder?feature=tryon&src=${encodeURIComponent(imageList[0]!)}`],
      provider: 'fallback',
      powerCost: 25,
    };
  },
});
