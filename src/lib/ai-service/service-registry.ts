/**
 * AI 服务层 — 服务注册中心
 *
 * 所有 AI 服务在此注册，统一调度。
 * 新增服务：创建 services/xxx.ts，导入并 register() 即可。
 */

import type { AIServiceType, ServiceConfig, GenerationRequest, GenerationResult } from './types';

// ============================================================
// ServiceRegistry
// ============================================================
class ServiceRegistry {
  private services = new Map<AIServiceType, ServiceConfig>();

  /**
   * 注册一个服务
   */
  register(config: ServiceConfig): void {
    if (this.services.has(config.type)) {
      console.warn(`[ServiceRegistry] 服务 ${config.type} 已存在，将被覆盖`);
    }
    this.services.set(config.type, config);
  }

  /**
   * 根据类型获取服务配置
   */
  get(type: AIServiceType): ServiceConfig | undefined {
    return this.services.get(type);
  }

  /**
   * 列出所有已注册服务
   */
  list(): ServiceConfig[] {
    return Array.from(this.services.values());
  }

  /**
   * 检查服务是否存在
   */
  has(type: AIServiceType): boolean {
    return this.services.has(type);
  }

  /**
   * 获取所有需要输入图片的服务
   */
  getImageRequired(): ServiceConfig[] {
    return this.list().filter(s => s.requiresImage);
  }

  /**
   * 获取所有不需要输入图片的服务
   */
  getNoImageRequired(): ServiceConfig[] {
    return this.list().filter(s => !s.requiresImage);
  }
}

// 全局单例
export const registry = new ServiceRegistry();

// ============================================================
// 辅助函数
// ============================================================

/**
 * 解析 resolution + ratio 为具体宽高
 */
export function parseImageSize(
  resolution?: string,
  ratio?: string
): { width: number; height: number } {
  const sizeMap: Record<string, { width: number; height: number }> = {
    '1k': { width: 512, height: 512 },
    '2k': { width: 512, height: 896 },
    '4k': { width: 1024, height: 1024 },
    'auto': { width: 512, height: 512 },
    '1:1': { width: 512, height: 512 },
    '2:3': { width: 512, height: 768 },
    '3:2': { width: 768, height: 512 },
    '3:4': { width: 512, height: 683 },
    '4:3': { width: 683, height: 512 },
    '4:5': { width: 512, height: 640 },
    '5:4': { width: 640, height: 512 },
    '9:16': { width: 288, height: 512 },
    '16:9': { width: 512, height: 288 },
    '21:9': { width: 672, height: 288 },
  };

  return sizeMap[resolution || ''] || sizeMap[ratio || ''] || { width: 512, height: 512 };
}

/**
 * 标准化 count（最大4）
 */
export function normalizeCount(count?: number): number {
  if (!count || count < 1) return 1;
  return Math.min(count, 4);
}
