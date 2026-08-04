/**
 * Phase 4.5 · Handlers 统一出口
 *
 * 使用：
 *   import { getHandler, runHandler } from '@/lib/ai/handlers';
 */

export {
  runHandler,
  type FeatureHandler,
  type HandlerOutcome,
  type ValidateFn,
  type BuildRequestFn,
  type PostProcessFn,
} from './handler.types';
export {
  handlerFromRegistry,
  buildHandlerRegistry,
  getHandler,
  getHandlers,
} from './handler-adapters';
