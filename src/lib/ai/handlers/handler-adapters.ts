/**
 * Phase 4.5 · Handler 适配器（17 功能 → Handler 形态）
 *
 * 从 service registry 自动生成 FeatureHandler：
 *   - validate: requiresImage 检查 + 基础参数校验
 *   - buildRequest: 透传输入 → GenerationRequest
 *   - execute: 委托 registry 服务的 execute（保留原有业务逻辑）
 *
 * 这样 17 个功能立即获得 Handler 形态，无需逐个重写（约束：不重写 17 功能）。
 */

import { registry } from '@/lib/ai-service/service-registry';
import type { GenerationRequest, GenerationResult } from '@/lib/ai-service/types';
import type { FeatureHandler } from './handler.types';

/** 从 registry 构建 handler（服务已注册时） */
export function handlerFromRegistry(serviceType: string): FeatureHandler | null {
  const config = registry.get(serviceType as never);
  if (!config) return null;

  const handler: FeatureHandler = {
    featureId: serviceType,
    label: config.label,
    powerCost: config.powerCost,
    requiresImage: config.requiresImage,

    validate(input) {
      if (!input || typeof input !== 'object') return '参数必须为对象';
      if (config.requiresImage) {
        const hasImage = !!input.image || Array.isArray(input.images) && (input.images as unknown[]).length > 0;
        if (!hasImage) return `该功能需要输入图片`;
      }
      return null;
    },

    buildRequest(input) {
      // 透传：service 的 execute 自行解析字段（与原行为一致）
      return input as unknown as GenerationRequest;
    },

    async execute(req) {
      return (config as unknown as { execute(req: GenerationRequest): Promise<GenerationResult> }).execute(req);
    },
  };

  return handler;
}

/** 构建全部已注册服务的 handler 表 */
export function buildHandlerRegistry(): Map<string, FeatureHandler> {
  const handlers = new Map<string, FeatureHandler>();
  for (const config of registry.list()) {
    const h = handlerFromRegistry(config.type);
    if (h) handlers.set(h.featureId, h);
  }
  return handlers;
}

/** 单例 handler 表（懒构建） */
let _handlers: Map<string, FeatureHandler> | null = null;
export function getHandlers(): Map<string, FeatureHandler> {
  if (!_handlers) {
    _handlers = buildHandlerRegistry();
  }
  return _handlers;
}

/** 获取单个 handler */
export function getHandler(featureId: string): FeatureHandler | undefined {
  return getHandlers().get(featureId);
}
