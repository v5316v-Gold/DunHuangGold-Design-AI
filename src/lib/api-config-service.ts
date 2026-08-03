/**
 * API 配置服务层
 *
 * 职责：
 * - 从数据库/环境变量读取运行时配置
 * - 配置缓存与内存管理
 * - 配置持久化（保存到 DB）
 *
 * 所有静态类型和常量已迁移到 @/config/api-config
 */

import { db } from '@/db';
import { apiConfigs, systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  type ImageProvider,
  type ApiConfig,
  coreApiConfigs,
  PROVIDER_ENDPOINTS,
  FEATURE_API_MAP,
  type VideoProvider,
  VIDEO_PROVIDER_ENDPOINTS,
  isFeatureEnabled,
  featureConfigs,
} from '@/config/api-config';

export type { ImageProvider, VideoProvider, ApiConfig };

export { PROVIDER_ENDPOINTS, VIDEO_PROVIDER_ENDPOINTS, FEATURE_API_MAP, coreApiConfigs };

// 图片生成 API 提供商类型（向后兼容别名）
export type ImageProviderType = ImageProvider;

// 环境变量配置映射 - 每个功能可以独立配置
const ENV_CONFIG_MAP: Record<string, {
  keyEnv: string;
  providerEnv?: string;
  modelEnv?: string;
  urlEnv?: string;
  defaultProvider: ImageProvider;
  defaultModel: string;
}> = {
  'generate-image': {
    keyEnv: 'MINIMAX_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    modelEnv: 'IMAGE_MODEL',
    urlEnv: 'IMAGE_API_URL',
    defaultProvider: 'minimax',
    defaultModel: 'image-01',
  },
  'relief': {
    keyEnv: 'IMAGE_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogview-3',
  },
  'image-3d': {
    keyEnv: 'MESHY_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    defaultProvider: 'meshy',
    defaultModel: 'meshy-1',
  },
  'product-refine': {
    keyEnv: 'IMAGE_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogview-3',
  },
  'multi-image': {
    keyEnv: 'IMAGE_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogview-3',
  },
  'multi-view': {
    keyEnv: 'IMAGE_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogview-3',
  },
  'sketch-realistic': {
    keyEnv: 'IMAGE_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogview-3',
  },
  'free-creation': {
    keyEnv: 'IMAGE_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogview-3',
  },
  'one-click-design': {
    keyEnv: 'IMAGE_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogview-3',
  },
  'remove-background': {
    keyEnv: 'IMAGE_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogview-3',
  },
  'upscale': {
    keyEnv: 'IMAGE_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogview-3',
  },
  'remove-watermark': {
    keyEnv: 'IMAGE_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogview-3',
  },
  'stereo': {
    keyEnv: 'IMAGE_API_KEY',
    providerEnv: 'IMAGE_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogview-3',
  },
  'text2video': {
    keyEnv: 'VIDEO_API_KEY',
    providerEnv: 'VIDEO_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogvideox',
  },
  'image2video': {
    keyEnv: 'VIDEO_API_KEY',
    providerEnv: 'VIDEO_PROVIDER',
    defaultProvider: 'zhipu',
    defaultModel: 'cogvideox',
  },
  'chat': {
    keyEnv: 'LLM_API_KEY',
    providerEnv: 'LLM_PROVIDER',
    modelEnv: 'LLM_MODEL',
    defaultProvider: 'zhipu',
    defaultModel: 'glm-4-7-251222',
  },
};

// 备选 API Key 环境变量列表（按优先级）
const FALLBACK_KEY_ENVS = [
  'IMAGE_API_KEY',
  'ZHIPU_API_KEY',
  'QWEN_API_KEY',
  'OPENAI_API_KEY',
  'MINIMAX_API_KEY',
];

// 内存配置存储（用于管理后台配置）
const memoryConfigStore: Map<string, ApiConfig> = new Map();

// 配置缓存
const configCache: Map<string, ApiConfig> = new Map();
let cacheExpiry = 0;
const CACHE_TTL = 60 * 1000; // 1 分钟缓存

// ==================== 配置模式 ====================

async function getConfigMode(): Promise<'database' | 'hybrid' | 'env'> {
  if (!db) return 'env';

  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, 'config_mode'))
      .limit(1);

    if (setting) {
      const mode = setting.value as string;
      if (mode === 'database' || mode === 'hybrid' || mode === 'env') return mode;
    }
  } catch (error) {
    console.error('[api-config-service] 读取配置模式失败:', error);
  }

  return 'hybrid';
}

// ==================== 公开 API ====================

/**
 * 获取 API 配置
 * 优先级：数据库（最高）> 内存 > 环境变量 > 默认配置
 */
export async function getApiConfig(configId: string): Promise<ApiConfig | null> {
  if (Date.now() < cacheExpiry && configCache.has(configId)) {
    console.log(`[api-config-service] 从缓存读取配置: ${configId}`);
    return configCache.get(configId) || null;
  }

  const configMode = await getConfigMode();
  console.log(`[api-config-service] 配置模式: ${configMode}`);

  // 1. 尝试从数据库读取
  if (db && configMode !== 'env') {
    try {
      const [dbConfig] = await db
        .select()
        .from(apiConfigs)
        .where(eq(apiConfigs.id, configId))
        .limit(1);

      if (dbConfig) {
        if (dbConfig.enabled && dbConfig.apiKey) {
          const config: ApiConfig = {
            id: dbConfig.id,
            name: dbConfig.name,
            apiKey: dbConfig.apiKey,
            provider: (dbConfig.provider as ImageProvider) || 'openai',
            model: dbConfig.model,
            url: dbConfig.url,
            enabled: dbConfig.enabled,
            timeout: dbConfig.timeout || 60000,
          };
          console.log(`[api-config-service] 从数据库读取配置: ${configId}, provider=${config.provider}`);
          configCache.set(configId, config);
          cacheExpiry = Date.now() + CACHE_TTL;
          return config;
        } else {
          console.log(`[api-config-service] 数据库中有配置但未启用或无API Key: ${configId}`);
          if (configMode === 'database') return null;
        }
      }
    } catch (error) {
      console.error('[api-config-service] 数据库读取失败:', error);
    }
  }

  // 2. 从内存配置读取
  if (memoryConfigStore.has(configId)) {
    const config = memoryConfigStore.get(configId)!;
    console.log(`[api-config-service] 从内存读取配置: ${configId}`);
    return config;
  }

  // 3. 从环境变量读取
  const envMapping = ENV_CONFIG_MAP[configId];
  if (envMapping) {
    const provider = (process.env[envMapping.providerEnv || ''] as ImageProvider) || envMapping.defaultProvider;

    const providerKeyMap: Record<ImageProvider, string> = {
      openai: 'OPENAI_API_KEY',
      zhipu: 'ZHIPU_API_KEY',
      qwen: 'QWEN_API_KEY',
      kimi: 'KIMI_API_KEY',
      minimax: 'MINIMAX_API_KEY',
      meshy: 'MESHY_API_KEY',
      custom: 'IMAGE_API_KEY',
    };

    let apiKey = process.env[providerKeyMap[provider]] || process.env['IMAGE_API_KEY'];

    if (!apiKey) {
      for (const keyEnv of FALLBACK_KEY_ENVS) {
        if (process.env[keyEnv]) {
          apiKey = process.env[keyEnv];
          console.log(`[api-config-service] 使用备选环境变量 ${keyEnv}`);
          break;
        }
      }
    }

    if (apiKey) {
      const config: ApiConfig = {
        id: configId,
        name: configId,
        apiKey,
        provider,
        model: process.env[envMapping.modelEnv || ''] || envMapping.defaultModel,
        url: process.env[envMapping.urlEnv || ''] || null,
        enabled: true,
        timeout: 60000,
      };
      console.log(`[api-config-service] 从环境变量读取配置: provider=${provider}`);
      configCache.set(configId, config);
      cacheExpiry = Date.now() + CACHE_TTL;
      return config;
    }
  }

  return null;
}

/**
 * 保存 API 配置
 * 优先保存到数据库，数据库不可用时保存到内存
 */
export async function saveApiConfig(configId: string, config: Partial<ApiConfig>): Promise<boolean> {
  const existingConfig = memoryConfigStore.get(configId) || {
    id: configId,
    name: configId,
    apiKey: null,
    provider: 'openai' as ImageProvider,
    model: null,
    url: null,
    enabled: true,
    timeout: 60000,
  };

  const newConfig: ApiConfig = { ...existingConfig, ...config, id: configId };

  memoryConfigStore.set(configId, newConfig);
  console.log(`[api-config-service] 配置已保存到内存: ${configId}`);

  configCache.delete(configId);
  cacheExpiry = 0;

  if (!db) {
    console.warn('[api-config-service] 数据库不可用，配置仅保存在内存中');
    return true;
  }

  try {
    const [existing] = await db
      .select()
      .from(apiConfigs)
      .where(eq(apiConfigs.id, configId))
      .limit(1);

    if (existing) {
      await db
        .update(apiConfigs)
        .set({
          apiKey: config.apiKey,
          provider: config.provider,
          model: config.model,
          url: config.url,
          enabled: config.enabled ?? existing.enabled,
          updatedAt: new Date(),
        })
        .where(eq(apiConfigs.id, configId));
    } else {
      await db.insert(apiConfigs).values({
        id: configId,
        name: newConfig.name,
        apiKey: config.apiKey || '',
        provider: config.provider || 'openai',
        model: config.model,
        url: config.url,
        enabled: config.enabled ?? true,
        timeout: newConfig.timeout,
      });
    }

    console.log(`[api-config-service] 配置已保存到数据库: ${configId}`);
    return true;
  } catch (error) {
    console.error('[api-config-service] 数据库保存失败:', error);
    return true;
  }
}

/**
 * 清除配置缓存
 */
export function clearConfigCache(configId?: string): void {
  if (configId) {
    configCache.delete(configId);
    console.log(`[api-config-service] 已清除配置 ${configId} 的缓存`);
  } else {
    configCache.clear();
    cacheExpiry = 0;
    console.log('[api-config-service] 已清除所有配置缓存');
  }
}

export function clearAllConfigCache(): void {
  configCache.clear();
  cacheExpiry = 0;
  console.log('[api-config-service] 已清除所有配置缓存');
}

/**
 * 获取内存中的配置（用于调试）
 */
export function getMemoryConfigs(): Map<string, ApiConfig> {
  return memoryConfigStore;
}

// ==================== 配置初始化（从数据库加载，仅服务端） ====================

let _configInitialized = false;

/**
 * 加载环境变量到 coreApiConfigs
 * 确保 coreApiConfigs.cloud.apiKey 从环境变量初始化
 */
function loadApiKeysFromEnv(): void {
  const envKeyMap: Record<string, string> = {
    'llm-chat': process.env.ZHIPU_API_KEY || process.env.QWEN_API_KEY || process.env.LLM_API_KEY || '',
    'image-generate': process.env.MINIMAX_API_KEY || process.env.IMAGE_API_KEY || process.env.ZHIPU_API_KEY || '',
    '3d-modeling': process.env.MESHY_API_KEY || process.env.IMAGE_API_KEY || process.env.ZHIPU_API_KEY || '',
    'video-generate': process.env.VIDEO_API_KEY || process.env.ZHIPU_API_KEY || '',
    'image-edit': process.env.MINIMAX_API_KEY || process.env.IMAGE_API_KEY || process.env.ZHIPU_API_KEY || '',
  };

  Object.entries(coreApiConfigs).forEach(([id, config]) => {
    // Only load from env if not already set from DB (DB takes priority)
    if (!config.cloud.apiKey && envKeyMap[id]) {
      config.cloud.apiKey = envKeyMap[id];
      console.log(`[api-config] 从环境变量加载 ${id}.cloud.apiKey`);
    }
  });
}

export async function initializeConfigs(force = false): Promise<void> {
  if (typeof window !== 'undefined') return;
  if (_configInitialized && !force) return;

  // 首先从环境变量加载（基础加载）
  loadApiKeysFromEnv();

  try {
    if (!db) {
      _configInitialized = true;
      return;
    }

    const dbConfigs = await db.select().from(apiConfigs);
    for (const dbConfig of dbConfigs) {
      const target = coreApiConfigs[dbConfig.id];
      if (target) {
        if (dbConfig.apiKey) target.cloud.apiKey = dbConfig.apiKey;
        if (dbConfig.provider) (target.cloud as Record<string, unknown>).provider = dbConfig.provider;
        if (dbConfig.model) target.cloud.model = dbConfig.model;
        if (dbConfig.url) target.cloud.url = dbConfig.url;
        if (dbConfig.enabled !== undefined) target.enabled = dbConfig.enabled;
      }
    }

    _configInitialized = true;
  } catch {
    _configInitialized = true;
  }
}

/**
 * 获取所有功能启用状态（供 admin 路由使用）
 * 内部自动调用 initializeConfigs 确保配置已加载
 */
export async function getAllFeaturesStatus(): Promise<Record<string, {
  enabled: boolean;
  apiId: string;
  reason?: string;
}>> {
  await initializeConfigs();
  const result: Record<string, { enabled: boolean; apiId: string; reason?: string }> = {};
  featureConfigs.forEach((feature) => {
    result[feature.id] = isFeatureEnabled(feature.id);
  });
  return result;
}

// 重新导出 featureApiMapping（向后兼容 admin 路由）
export { featureApiMapping } from '@/config/api-config';
