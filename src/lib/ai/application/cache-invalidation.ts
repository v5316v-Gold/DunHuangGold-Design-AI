/**
 * Phase 5.7 · 缓存失效（Redis cache 联动 DB 更新）
 *
 * ADR-012（运行时配置在 DB + Redis 缓存）
 *
 * 模式：
 *   get(key)      → Redis GET → miss 则 DB → Redis SET（TTL）
 *   invalidate(key) → Redis DEL（配置更新后调用，保证前端即时反映）
 *   Redis 不可用 → 直接 DB（fail-open）
 */

import { getRedis } from '@/lib/redis';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('cache-invalidation');

const DEFAULT_TTL_SEC = 300; // 5 分钟

/**
 * 缓存读取（Redis → fallback fn → 回填）
 */
export async function cacheGet<T>(
  key: string,
  fetchFn: () => Promise<T>,
  opts: { ttlSec?: number } = {}
): Promise<T> {
  try {
    const redis = getRedis();
    const cached = await redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        // 缓存损坏 → 忽略，走 DB
      }
    }
  } catch {
    // Redis 不可用 → 直接 DB
  }

  const value = await fetchFn();

  // 回填缓存（Redis 不可用静默）
  try {
    const redis = getRedis();
    await redis.set(key, JSON.stringify(value), 'EX', opts.ttlSec ?? DEFAULT_TTL_SEC);
  } catch {
    // 静默
  }

  return value;
}

/**
 * 缓存失效（配置更新后调用）
 */
export async function cacheInvalidate(...keys: string[]): Promise<void> {
  try {
    const redis = getRedis();
    if (keys.length === 0) return;
    await redis.del(keys);
    logger.info(`缓存失效: ${keys.join(', ')}`);
  } catch (error) {
    // Redis 不可用 → 记录但不阻断（下次读取会回填新值）
    logger.warn('缓存失效失败（Redis 不可用）', error);
  }
}

/** 功能配置缓存键 */
export const featureCacheKey = (featureId: string) => `config:feature:${featureId}`;
export const featuresListCacheKey = 'config:features:all';
export const providerCacheKey = (providerId: string) => `config:provider:${providerId}`;
