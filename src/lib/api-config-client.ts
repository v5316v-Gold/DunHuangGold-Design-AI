/**
 * API 配置 — 客户端安全版本
 *
 * 所有类型和常量已迁移到 @/config/api-config
 * 本文件保留用于向后兼容，新代码请直接从 @/config/api-config 导入
 */

export {
  type ImageProvider,
  type VideoProvider,
  type ApiConfig,
  type CoreApiConfig,
  type FeatureConfig,
  type PowerSource,
  type ApiCategory,
  PROVIDER_ENDPOINTS,
  VIDEO_PROVIDER_ENDPOINTS,
  coreApiConfigs,
  featureConfigs,
  FEATURE_API_MAP,
  FEATURE_COSTS,
  getFeatureCost,
  getFeatureConfig,
  getFeatureApiId,
} from '@/config/api-config';
