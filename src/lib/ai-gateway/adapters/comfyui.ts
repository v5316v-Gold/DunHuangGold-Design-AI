/**
 * ComfyUI Adapter（Hexagonal 实现）
 *
 * 职责：把 IAIGenerationPort 的接口适配到本地 ComfyUI HTTP API
 *
 * 设计：
 * - 依赖倒置：只依赖 port.ts 的接口契约
 * - 可替换：未来可换成 Tripo3D / Kling Adapter
 * - 复用现有工具：comfyui-service.ts 的封装函数
 */

import {
  checkComfyUIHealth,
  refineImage,
  removeBackground,
  upscaleImage,
  removeWatermark,
  sketchToRealistic,
  reliefEffect,
  textToImageZTurbo,
  textToImage,
} from '@/lib/comfyui-service';
import type { GenerationResult, Provider } from '@/lib/ai-service/types';
import type {
  IAIGenerationPort,
  GenerationRequest,
} from '../port';

export class ComfyUIAdapter implements IAIGenerationPort {
  readonly name = 'comfyui';

  async isAvailable(): Promise<boolean> {
    try {
      return await checkComfyUIHealth();
    } catch {
      return false;
    }
  }

  async execute(req: GenerationRequest): Promise<GenerationResult> {
    const { service } = req;
    try {
      switch (service) {
        case 'text2img':
          return await this.text2img(req);
        case 'refine':
          return await this.refine(req);
        case 'relief':
          return await this.relief(req);
        case 'removebg':
          return await this.removebg(req);
        case 'upscale':
          return await this.upscale(req);
        case 'watermark':
          return await this.watermark(req);
        case 'sketch':
          return await this.sketch(req);
        default:
          return {
            success: false,
            error: `ComfyUI 不支持服务: ${service}`,
            provider: 'comfyui' as Provider,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        provider: 'comfyui' as Provider,
      };
    }
  }

  // ============================================================
  // 各服务实现
  // ============================================================

  private async text2img(req: GenerationRequest): Promise<GenerationResult> {
    const { prompt = '', width = 512, height = 512, count = 1 } = req;

    // 先 Z-Turbo，失败回退 SD1.5
    const zTurbo = await textToImageZTurbo({ prompt, width, height, count });
    if (zTurbo.success && zTurbo.images?.length) {
      return {
        success: true,
        data: zTurbo.images,
        provider: 'comfyui' as Provider,
        workflow: 'Z-Image-Turbo',
      };
    }

    const sd = await textToImage({ prompt, width, height, count });
    if (sd.success && sd.images?.length) {
      return {
        success: true,
        data: sd.images,
        provider: 'comfyui' as Provider,
        workflow: 'SD1.5',
      };
    }

    return {
      success: false,
      error: zTurbo.error || sd.error || 'ComfyUI 生成失败',
      provider: 'comfyui' as Provider,
    };
  }

  private async refine(req: GenerationRequest): Promise<GenerationResult> {
    const { image } = req;
    if (!image) {
      return { success: false, error: '需要输入图片', provider: 'comfyui' as Provider };
    }
    const r = await refineImage(image);
    return r.success && r.images?.length
      ? {
          success: true,
          data: r.images[0],
          provider: 'comfyui' as Provider,
          workflow: 'img2img',
        }
      : {
          success: false,
          error: r.error || '精修失败',
          provider: 'comfyui' as Provider,
        };
  }

  private async relief(req: GenerationRequest): Promise<GenerationResult> {
    const { image } = req;
    if (!image) {
      return { success: false, error: '需要输入图片', provider: 'comfyui' as Provider };
    }
    const r = await reliefEffect(image);
    return r.success && r.images?.length
      ? {
          success: true,
          data: r.images[0],
          provider: 'comfyui' as Provider,
          workflow: 'relief',
        }
      : {
          success: false,
          error: r.error || '浮雕失败',
          provider: 'comfyui' as Provider,
        };
  }

  private async removebg(req: GenerationRequest): Promise<GenerationResult> {
    const { image } = req;
    if (!image) {
      return { success: false, error: '需要输入图片', provider: 'comfyui' as Provider };
    }
    const r = await removeBackground(image);
    return r.success && r.images?.length
      ? { success: true, data: r.images[0], provider: 'comfyui' as Provider, workflow: 'removebg' }
      : { success: false, error: r.error || '去背景失败', provider: 'comfyui' as Provider };
  }

  private async upscale(req: GenerationRequest): Promise<GenerationResult> {
    const { image, scale = 2 } = req;
    if (!image) {
      return { success: false, error: '需要输入图片', provider: 'comfyui' as Provider };
    }
    const r = await upscaleImage(image, Number(scale));
    return r.success && r.images?.length
      ? { success: true, data: r.images[0], provider: 'comfyui' as Provider, workflow: 'upscale' }
      : { success: false, error: r.error || '放大失败', provider: 'comfyui' as Provider };
  }

  private async watermark(req: GenerationRequest): Promise<GenerationResult> {
    const { image } = req;
    if (!image) {
      return { success: false, error: '需要输入图片', provider: 'comfyui' as Provider };
    }
    const r = await removeWatermark(image);
    return r.success && r.images?.length
      ? { success: true, data: r.images[0], provider: 'comfyui' as Provider, workflow: 'watermark' }
      : { success: false, error: r.error || '去水印失败', provider: 'comfyui' as Provider };
  }

  private async sketch(req: GenerationRequest): Promise<GenerationResult> {
    const { image } = req;
    if (!image) {
      return { success: false, error: '需要输入图片', provider: 'comfyui' as Provider };
    }
    const r = await sketchToRealistic(image);
    return r.success && r.images?.length
      ? { success: true, data: r.images[0], provider: 'comfyui' as Provider, workflow: 'sketch' }
      : { success: false, error: r.error || '线稿转写实失败', provider: 'comfyui' as Provider };
  }
}