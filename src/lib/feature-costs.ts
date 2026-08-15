import { apiClient, API_ROUTES } from '@/lib/api-client';
/**
 * 功能算力配置 - 支持管理员配置动态值
 */

const FEATURE_COSTS_STORAGE_KEY = 'dunhuang-feature-costs';

// 默认功能算力配置
const DEFAULT_FEATURE_COSTS: Record<string, number> = {
  dialogue: 2,
  text2img: 15,
  refine: 20,
  blend: 15,
  oneclick: 15,
  multiview: 20,
  sketch: 15,
  free: 15,
  relief: 20,
  image3d: 30,
  removebg: 5,
  upscale: 5,
  watermark: 5,
  text2video: 50,
  img2video: 40,
  '2dto3d': 25,
  tryon: 25,
};

/**
 * 从localStorage读取缓存
 */
function getCachedCosts(): Record<string, number> | null {
  try {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(FEATURE_COSTS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[feature-costs] 读取缓存失败:', e);
  }
  return null;
}

/**
 * 保存到localStorage
 */
function saveCachedCosts(costs: Record<string, number>): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(FEATURE_COSTS_STORAGE_KEY, JSON.stringify(costs));
  } catch (e) {
    console.warn('[feature-costs] 保存缓存失败:', e);
  }
}

/**
 * 获取单个功能的算力值（同步，优先返回缓存值）
 */
export function getFeatureCost(featureId: string): number {
  const cached = getCachedCosts();
  if (cached && featureId in cached) {
    return cached[featureId];
  }
  return DEFAULT_FEATURE_COSTS[featureId] ?? 10;
}

/**
 * 获取所有功能算力配置（同步）
 */
export function getAllFeatureCosts(): Record<string, number> {
  const cached = getCachedCosts();
  return cached ? { ...cached } : { ...DEFAULT_FEATURE_COSTS };
}

/**
 * 从公共 API 加载功能算力配置（异步）
 * 任何用户可读，无需鉴权
 */
export async function preloadFeatureCosts(): Promise<void> {
  try {
    const data = await apiClient.get<{ costs: Record<string, number>; source?: string }>(API_ROUTES.featureCosts, { auth: false });

    if (data.success && data.data?.costs) {
      // 保存到缓存
      saveCachedCosts(data.data.costs);
      console.log('[feature-costs] 已加载最新配置:', data.data.costs, '来源:', data.data.source);
      return;
    }
  } catch (e) {
    console.warn('[feature-costs] 加载配置失败，使用默认值:', e);
  }
  // 加载失败时保存默认配置到缓存
  saveCachedCosts(DEFAULT_FEATURE_COSTS);
}

/**
 * 保存功能算力配置（管理员保存时调用）
 */
export async function saveFeatureCosts(costs: Record<string, number>): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/feature-costs', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(typeof window !== 'undefined' && localStorage.getItem('dunhuang_token')
          ? { Authorization: `Bearer ${localStorage.getItem('dunhuang_token')}` }
          : {}),
      },
      body: JSON.stringify({ features: costs }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        // 保存到本地缓存
        saveCachedCosts(costs);
        console.log('[feature-costs] 已保存配置:', costs);
        return true;
      }
    }
  } catch (e) {
    console.error('[feature-costs] 保存配置失败:', e);
  }
  return false;
}

/**
 * 清除本地缓存
 */
export function clearFeatureCostsCache(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(FEATURE_COSTS_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('[feature-costs] 清除缓存失败:', e);
  }
}

// 保持向后兼容
export const FEATURE_COSTS = DEFAULT_FEATURE_COSTS;
