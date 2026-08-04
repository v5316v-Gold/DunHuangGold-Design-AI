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

// 全局 crypto.randomUUID（Node 18+/Next 运行时可用；避免 CJS interop 问题）
function uuid(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `uuid-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

/** 生成/复用 requestId（优先 X-Request-Id 头，缺省生成） */
export function resolveRequestId(request?: NextRequest): string {
  if (request) {
    const fromHeader = request.headers.get('X-Request-Id');
    if (fromHeader) return fromHeader;
  }
  return `req_${uuid()}`;
}

// ==================== 成功响应 ====================

export function apiSuccess<T = unknown>(
  data: T,
  extra: Record<string, unknown> = {},
  request?: NextRequest
): NextResponse {
  return NextResponse.json({
    success: true,
    data,
    requestId: resolveRequestId(request),
    ...extra,
  });
}

export function apiSuccessRaw(
  body: Record<string, unknown>,
  request?: NextRequest
): NextResponse {
  return NextResponse.json({ success: true, requestId: resolveRequestId(request), ...body });
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
  details?: unknown,
  request?: NextRequest
): NextResponse {
  const body: ApiError = { success: false, error: message };
  if (code) body.code = code;
  if (details !== undefined) body.details = details;
  (body as unknown as Record<string, unknown>).requestId = resolveRequestId(request);
  return NextResponse.json(body, { status });
}

// ==================== 快捷错误响应 ====================

export const unauthorized = (message = '请先登录', request?: NextRequest) =>
  apiError(message, 401, 'UNAUTHORIZED', undefined, request);

export const forbidden = (message = '无权限访问', request?: NextRequest) =>
  apiError(message, 403, 'FORBIDDEN', undefined, request);

export const notFound = (message = '资源不存在', request?: NextRequest) =>
  apiError(message, 404, 'NOT_FOUND', undefined, request);

export const badRequest = (message: string, details?: unknown, request?: NextRequest) =>
  apiError(message, 400, 'VALIDATION_ERROR', details, request);

export const internalError = (error: unknown, fallback = '服务器内部错误', request?: NextRequest) =>
  apiError(sanitizeError(error, fallback).message, 500, 'INTERNAL_ERROR', undefined, request);

export const serviceUnavailable = (message = '服务暂时不可用', request?: NextRequest) =>
  apiError(message, 503, 'SERVICE_UNAVAILABLE', undefined, request);

export const insufficientPower = (message = '算力不足', request?: NextRequest) =>
  apiError(message, 400, 'POWER_INSUFFICIENT', undefined, request);

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
