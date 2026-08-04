/**
 * Phase 4.5 · Handler 接口（统一 handler 形态）
 *
 * Spec: 05-L3-Orchestration §9 + EXECUTION-PLAN 4.5
 *
 * 每个功能 = 一个 Handler（validate → buildExecutionRequest → postProcess 三阶段）。
 * 本文件定义 Handler 形态；handler-adapters.ts 提供从现有 service registry 的通用适配，
 * 17 个功能无需重写即可获得 handler 形态（约束：不重写 17 功能）。
 */

import type { GenerationRequest, GenerationResult } from '@/lib/ai-service/types';

// ==================== Handler 三阶段 ====================

/** 参数校验：返回错误信息或 null（通过） */
export type ValidateFn = (input: Record<string, unknown>) => string | null;

/** 构建执行请求：把用户输入规范化为 GenerationRequest */
export type BuildRequestFn = (input: Record<string, unknown>) => GenerationRequest;

/** 结果后处理：可选转换（保存作品/格式化输出等） */
export type PostProcessFn = (result: GenerationResult, input: Record<string, unknown>) => Promise<GenerationResult> | GenerationResult;

// ==================== Handler 定义 ====================

export interface FeatureHandler {
  /** 功能 ID（短 id） */
  featureId: string;
  label: string;
  powerCost: number;
  requiresImage: boolean;
  validate: ValidateFn;
  buildRequest: BuildRequestFn;
  /** 实际执行（默认走 registry service.execute） */
  execute(req: GenerationRequest): Promise<GenerationResult>;
  postProcess?: PostProcessFn;
}

// ==================== Handler 执行结果 ====================

export interface HandlerOutcome {
  success: boolean;
  result?: GenerationResult;
  error?: { code: string; message: string; retryable: boolean };
}

/** 执行 handler 完整流程（validate → buildRequest → execute → postProcess） */
export async function runHandler(
  handler: FeatureHandler,
  input: Record<string, unknown>
): Promise<HandlerOutcome> {
  // 1. validate
  const validationError = handler.validate(input);
  if (validationError) {
    return {
      success: false,
      error: { code: 'INVALID_INPUT', message: validationError, retryable: false },
    };
  }

  // 2. buildRequest
  const req = handler.buildRequest(input);

  // 3. execute
  let result: GenerationResult;
  try {
    result = await handler.execute(req);
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'EXECUTOR_EXCEPTION',
        message: error instanceof Error ? error.message : '执行失败',
        retryable: true,
      },
    };
  }

  // 4. postProcess
  if (!result.success) {
    return {
      success: false,
      error: {
        code: 'EXECUTION_FAILED',
        message: result.error ?? '生成失败',
        retryable: true,
      },
    };
  }
  if (handler.postProcess) {
    result = await handler.postProcess(result, input);
  }

  return { success: true, result };
}
