/**
 * Phase 4.6 · AI Registry（服务注册表统一入口）
 *
 * 目标目录收敛：ai-service/service-registry → ai/registry
 * 兼容：旧路径 @/lib/ai-service/service-registry 仍可用（re-export）
 */

export { registry, parseImageSize, normalizeCount } from '@/lib/ai-service/service-registry';
export type {
  ServiceConfig,
  AIServiceType,
  GenerationRequest,
  GenerationResult,
  Provider,
} from '@/lib/ai-service/types';

/** 触发全部服务注册（side-effect import） */
export { registerAllServices } from './register-all';
