/**
 * 统一 API 响应格式
 *
 * 标准格式：
 *   { success: true, data: T }
 *   { success: false, error: string, code?: string, details?: unknown }
 *
 * HTTP Status：
 *   200 — 成功
 *   400 — 参数错误 / 业务校验失败
 *   401 — 未登录
 *   403 — 无权限
 *   404 — 资源不存在
 *   500 — 服务器内部错误
 */

import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from './validators';

// ==================== 成功响应 ====================

export function apiSuccess<T = unknown>(
  data: T,
  extra: Record<string, unknown> = {}
): NextResponse {
  return NextResponse.json({ success: true, data, ...extra });
}

export function apiSuccessRaw(body: Record<string, unknown>): NextResponse {
  return NextResponse.json({ success: true, ...body });
}

// ==================== 错误响应 ====================

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INVALID_PARAMETER'
  | 'POWER_INSUFFICIENT';

export interface ApiError {
  success: false;
  error: string;
  code?: ApiErrorCode;
  details?: unknown;
}

/**
 * 通用错误响应
 * @param message 用户友好错误信息
 * @param code 错误码
 * @param status HTTP 状态码
 * @param details 附加详情（可选）
 */
export function apiError(
  message = '服务器内部错误',
  status: 400 | 401 | 403 | 404 | 500 | 502 | 503 = 500,
  code?: ApiErrorCode,
  details?: unknown
): NextResponse {
  const body: ApiError = { success: false, error: message };
  if (code) body.code = code;
  if (details !== undefined) body.details = details;
  return NextResponse.json(body, { status });
}

// ==================== 快捷错误响应 ====================

export const unauthorized = (message = '请先登录') =>
  apiError(message, 401, 'UNAUTHORIZED');

export const forbidden = (message = '无权限访问') =>
  apiError(message, 403, 'FORBIDDEN');

export const notFound = (message = '资源不存在') =>
  apiError(message, 404, 'NOT_FOUND');

export const badRequest = (message: string, details?: unknown) =>
  apiError(message, 400, 'VALIDATION_ERROR', details);

export const internalError = (error: unknown, fallback = '服务器内部错误') =>
  apiError(sanitizeError(error, fallback).message, 500, 'INTERNAL_ERROR');

export const serviceUnavailable = (message = '服务暂时不可用') =>
  apiError(message, 503, 'SERVICE_UNAVAILABLE');

export const insufficientPower = (message = '算力不足') =>
  apiError(message, 400, 'POWER_INSUFFICIENT');

// ==================== 捕获处理器（用于 try/catch） ====================

/**
 * 在路由 handler 中替代手动 try/catch：
 *
 * export async function POST(request: NextRequest) {
 *   return handleCatch(request, async () => {
 *     // 业务逻辑
 *     return apiSuccess(data);
 *   });
 * }
 */
export async function handleCatch<T>(
  request: NextRequest,
  fn: () => Promise<NextResponse<T>>
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    console.error('[api-response] Unhandled error:', error);
    return internalError(error);
  }
}

/**
 * 验证必填参数，返回 400 或继续执行
 */
export function requireParam(
  value: unknown,
  paramName: string
): asserts value is NonNullable<unknown> {
  if (value === undefined || value === null || value === '') {
    throw Object.assign(
      new Error(`缺少必需参数: ${paramName}`),
      { __isValidation: true, paramName }
    );
  }
}
