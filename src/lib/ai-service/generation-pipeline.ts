/**
 * AI 服务层 — 统一执行管道
 *
 * 职责：
 * 1. 查找服务配置
 * 2. 算力检查
 * 3. 参数校验
 * 4. 执行主逻辑（ComfyUI）
 * 5. 云端兜底（Minimax / Meshy / Kling）
 * 6. 保存 + 记录 artworks
 * 7. 扣除算力
 */

import { getCurrentUser, requireAuth } from '@/lib/auth';
import { db } from '@/storage/database/db';
import { works } from '@/storage/database/shared/schema';
import { registry } from './service-registry';
import type { AIServiceType, GenerationRequest, GenerationResult, Provider } from './types';
import { saveImagesFromUrls } from './storage-helper';
import { createLogger } from '@/lib/error-handler';
import { getFeatureCost } from '@/lib/api-config';
import { checkUserPower, deductUserPower } from './power-helper';

const logger = createLogger('generation-pipeline');

// ============================================================
// GenerationPipeline
// ============================================================
export class GenerationPipeline {
  /**
   * 执行生成（主入口）
   *
   * 流程：参数校验 → 算力检查 → 执行服务 → 兜底 → 保存 → 扣费
   */
  async execute(
    type: AIServiceType,
    req: GenerationRequest,
    userId: string
  ): Promise<GenerationResult> {
    const config = registry.get(type);

    if (!config) {
      logger.warn(`未知服务类型: ${type}`);
      return { success: false, error: `未知服务类型: ${type}`, provider: 'fallback' };
    }

    logger.info(`执行服务: ${type}`, {
      userId,
      prompt: req.prompt?.substring(0, 50),
      hasImage: !!(req.image || req.images?.length),
    });

    // 1. 算力检查（直接查 DB，避免 HTTP auth 头丢失问题）
    const powerCost = getFeatureCost(type);
    const hasPower = await checkUserPower(userId, powerCost);
    if (!hasPower) {
      return { success: false, error: '算力不足', provider: 'fallback', powerCost };
    }

    // 2. 图片参数校验
    if (config.requiresImage && !req.image && !req.images?.length) {
      return {
        success: false,
        error: `${config.label}需要上传图片`,
        provider: 'fallback',
      };
    }

    // 3. 执行主逻辑
    let result = await config.execute(req);

    // 4. 云端兜底（ComfyUI 失败时有 cloudProvider）
    if (!result.success && config.cloudProvider) {
      logger.info(`[${type}] 主提供者失败，切换云端: ${config.cloudProvider}`);
      result = await this.executeCloudFallback(config.cloudProvider, req);

      // 云端也失败，尝试其他云
      if (!result.success && config.cloudProvider !== 'minimax') {
        result = await this.executeMinimaxFallback(req);
      }
    }

    // 5. 保存结果
    if (result.success && result.data) {
      const imageUrls = Array.isArray(result.data) ? result.data : [result.data];
      const { localUrls, failedUrls } = await saveImagesFromUrls(imageUrls);

      // 保存到 artworks 表
      await this.saveArtwork(userId, type, req.prompt || '', localUrls, imageUrls);

      // 记录
      if (failedUrls.length > 0) {
        logger.warn(`[${type}] 部分图片保存失败`, { failed: failedUrls.length });
      }

      result.data = localUrls.length > 0 ? localUrls : imageUrls;
      result.localSaved = localUrls.length > 0;
      result.powerCost = powerCost;

      // 6. 扣除算力（直接写 DB）
      await deductUserPower(userId, type, powerCost);
    }

    return result;
  }

  // ============================================================
  // 私有方法
  // ============================================================

  // (checkPower 和 deductPower 已迁移到 power-helper.ts，直接调 DB 函数)
  // 保留占位，避免删改引入其他引用问题

  /**
   * 保存到 artworks 表
   */
  private async saveArtwork(
    userId: string,
    type: string,
    prompt: string,
    localUrls: string[],
    originalUrls: string[]
  ): Promise<void> {
    if (!db) return;

    try {
      const title = this.getServiceTitle(type);
      for (const url of localUrls.length > 0 ? localUrls : originalUrls) {
        await db.insert(works).values({
          userId: userId,
          title: `${title}-${Date.now()}`,
          type,
          prompt,
          outputImageUrl: url,
        });
      }
    } catch (error) {
      logger.error('[saveArtwork] 保存作品记录失败', error);
    }
  }

  /**
   * 云端兜底（指定 provider）
   */
  private async executeCloudFallback(
    provider: Provider,
    req: GenerationRequest
  ): Promise<GenerationResult> {
    if (provider === 'minimax') {
      return this.executeMinimaxFallback(req);
    }
    // 其他云端暂不支持
    return { success: false, error: `云端 ${provider} 暂不支持`, provider };
  }

  /**
   * Minimax 兜底（从 generate-image 路由提取）
   */
  private async executeMinimaxFallback(req: GenerationRequest): Promise<GenerationResult> {
    try {
      const { count = 1, prompt = '' } = req;
      if (!prompt) {
        return { success: false, error: 'Minimax 兜底需要 prompt', provider: 'minimax' };
      }

      // G7/G8 加固 (Phase 9.22): 统一走 minimax-call-service（错误标准化 + retry 语义）
      const { minimaxImageGen } = await import('@/lib/minimax-call-service');
      const r = await minimaxImageGen({
        prompt,
        n: normalizeCount(count),
        featureId: 'text2img',
      });

      if (!r.success || !r.data) {
        return {
          success: false,
          error: r.error || 'Minimax 调用失败',
          provider: 'minimax',
        };
      }
      const imageUrls: string[] = r.data.image_urls || [];
      if (imageUrls.length === 0) {
        return { success: false, error: 'Minimax 未返回有效图片', provider: 'minimax' };
      }
      return { success: true, data: imageUrls, provider: 'minimax' };
    } catch (error) {
      logger.error('[MinimaxFallback] 调用失败', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Minimax 调用失败',
        provider: 'minimax',
      };
    }
  }

  private getServiceTitle(type: string): string {
    const titles: Record<string, string> = {
      text2img: '文生图',
      refine: '产品精修',
      relief: '浮雕设计',
      image3d: '图转3D',
      removebg: '移除背景',
      upscale: '高清放大',
      sketch: '线稿写实',
      blend: '多图融合',
      oneclick: '一键设计',
      multiview: '多视图',
      free: '自由创作',
    };
    return titles[type] || type;
  }
}

function normalizeCount(count?: number): number {
  if (!count || count < 1) return 1;
  return Math.min(count, 4);
}

export const pipeline = new GenerationPipeline();
