/**
 * Phase 5.3 · ConfigService（运行时配置中心化）
 *
 * ADR-012（DB 运行时真源）+ ADR-003（metadata 驱动）
 *
 * - 功能配置：DB features 表（真源）→ 静态 seed（默认值）→ 缓存
 * - 变更即时生效：admin 更新后调用 invalidateFeature()
 * - 前端读取 /api/features 即反映最新（无双重真源）
 */

import { featureRepository, type FeatureRow } from '@/db/repositories/feature-repository';
import {
  cacheGet,
  cacheInvalidate,
  featureCacheKey,
  featuresListCacheKey,
} from './cache-invalidation';

export class ConfigService {
  /** 获取单个功能配置（缓存优先） */
  async getFeature(featureId: string): Promise<FeatureRow | null> {
    return cacheGet(
      featureCacheKey(featureId),
      () => featureRepository.findById(featureId)
    );
  }

  /** 获取全部启用功能（缓存优先） */
  async listEnabledFeatures(): Promise<FeatureRow[]> {
    return cacheGet(featuresListCacheKey, () => featureRepository.listEnabled());
  }

  /** 功能配置更新后调用（admin 写入 DB 后） */
  async invalidateFeature(featureId?: string): Promise<void> {
    if (featureId) {
      await cacheInvalidate(featureCacheKey(featureId), featuresListCacheKey);
    } else {
      await cacheInvalidate(featuresListCacheKey);
    }
  }
}

export const configService = new ConfigService();
