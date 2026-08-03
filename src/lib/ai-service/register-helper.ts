/**
 * AI 服务层 — 服务注册工具函数
 *
 * 把 boilerplate 抽出来：每个服务文件只写 execute 函数即可。
 * 模板：服务配置已绑定、registry 已注册。
 */

import type { ServiceConfig, AIServiceType } from './types';
import { registry } from './service-registry';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('service:register');

/**
 * 注册 AI 服务的统一入口
 *
 * 替代每个服务文件里的：
 *   import { registry } from '../service-registry';
 *   registry.register({ type, label, ..., async execute(req) { ... } });
 *
 * 用法：
 *   export default registerService({
 *     type: 'sketch',
 *     label: '线稿写实',
 *     powerCost: 15,
 *     requiresImage: true,
 *     primaryProvider: 'comfyui',
 *     cloudProvider: 'minimax',
 *     async execute(req) { ... },
 *   });
 */
export function registerService<T extends AIServiceType>(config: ServiceConfig & { type: T }): ServiceConfig {
  if (registry.has(config.type)) {
    logger.warn(`服务 ${config.type} 重复注册，将被覆盖`);
  }
  registry.register(config);
  return config;
}

/**
 * 创建一个标准化的"暂未实现"execute 函数
 *
 * 用于 stub 服务，返回明确错误而不是"未知服务类型"
 * 真实实现会在后续迭代中替换
 */
export function stubExecute(serviceType: AIServiceType, reason = '功能开发中') {
  return async (): Promise<{ success: false; error: string; provider: 'fallback' }> => {
    logger.warn(`[${serviceType}] 调用了 stub: ${reason}`);
    return {
      success: false,
      error: `${serviceType}: ${reason}`,
      provider: 'fallback',
    };
  };
}