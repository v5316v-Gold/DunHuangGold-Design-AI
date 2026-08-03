/**
 * Phase 2 · 统一 API 响应格式
 *
 * Spec: docs/03-L2-API.md §6, §7
 *
 * Success envelope:
 *   { success: true, data: T, requestId: string, meta?: {...} }
 *
 * Failure envelope:
 *   { success: false, error: { code, message, details? }, requestId: string }
 *
 * HTTP Status 映射:
 *   200, 201 — success
 *   400 — INVALID_INPUT
 *   401 — AUTH_REQUIRED, INVALID_CREDENTIALS
 *   403 — PERMISSION_DENIED
 *   404 — FEATURE_NOT_FOUND, TASK_NOT_FOUND
 *   409 — DUPLICATE_REQUEST
 *   422 — INSUFFICIENT_POWER, FEATURE_DISABLED
 *   429 — RATE_LIMITED
 *   500 — INTERNAL_ERROR
 *   502, 503 — PROVIDER_UNAVAILABLE, STORAGE_FAILED
 */
import { NextResponse } from 'next/server';

// ==================== 16 错误码（per 03-L2 §7）====================

export const API_ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  INVALID_INPUT: 'INVALID_INPUT',
  FEATURE_NOT_FOUND: 'FEATURE_NOT_FOUND',
  FEATURE_DISABLED: 'FEATURE_DISABLED',
  INSUFFICIENT_POWER: 'INSUFFICIENT_POWER',
  DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_NOT_CANCELLABLE: 'TASK_NOT_CANCELLABLE',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  WORKFLOW_NOT_FOUND: 'WORKFLOW_NOT_FOUND',
  WORKFLOW_FAILED: 'WORKFLOW_FAILED',
  STORAGE_FAILED: 'STORAGE_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

// 错误码 → HTTP 状态码 映射（per 03-L2 §7）
export const ERROR_CODE_TO_HTTP_STATUS: Record<ApiErrorCode, number> = {
  AUTH_REQUIRED: 401,
  INVALID_CREDENTIALS: 401,
  PERMISSION_DENIED: 403,
  INVALID_INPUT: 400,
  FEATURE_NOT_FOUND: 404,
  FEATURE_DISABLED: 422,
  INSUFFICIENT_POWER: 422,
  DUPLICATE_REQUEST: 409,
  TASK_NOT_FOUND: 404,
  TASK_NOT_CANCELLABLE: 409,
  PROVIDER_UNAVAILABLE: 503,
  WORKFLOW_NOT_FOUND: 404,
  WORKFLOW_FAILED: 500,
  STORAGE_FAILED: 502,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

// ==================== Envelope 类型 ====================

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
  requestId: string;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
  requestId: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiFailure;

// ==================== 响应构造函数 ====================

/**
 * 成功响应（200）
 */
export function ok<T>(
  data: T,
  ctx: { requestId: string; meta?: Record<string, unknown> }
): NextResponse {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    requestId: ctx.requestId,
    meta: ctx.meta,
  };
  return NextResponse.json(body);
}

/**
 * 创建 201 Created 响应
 */
export function created<T>(
  data: T,
  ctx: { requestId: string; meta?: Record<string, unknown> }
): NextResponse {
  return ok(data, ctx); // 200 OK 表示创建成功（项目惯例）
}

/**
 * 失败响应（按错误码自动设 HTTP 状态）
 */
export function fail(
  code: ApiErrorCode,
  message: string,
  ctx: { requestId: string; details?: unknown; statusOverride?: number }
): NextResponse {
  const body: ApiFailure = {
    success: false,
    error: {
      code,
      message,
      ...(ctx.details !== undefined ? { details: ctx.details } : {}),
    },
    requestId: ctx.requestId,
  };
  const status = ctx.statusOverride ?? ERROR_CODE_TO_HTTP_STATUS[code];
  return NextResponse.json(body, { status });
}

// ==================== 便捷别名 ====================

export const ApiErrors = {
  authRequired: (requestId: string, msg = '未登录') =>
    fail(API_ERROR_CODES.AUTH_REQUIRED, msg, { requestId }),
  invalidCredentials: (requestId: string, msg = '凭证无效') =>
    fail(API_ERROR_CODES.INVALID_CREDENTIALS, msg, { requestId }),
  permissionDenied: (requestId: string, msg = '无权限') =>
    fail(API_ERROR_CODES.PERMISSION_DENIED, msg, { requestId }),
  invalidInput: (requestId: string, msg = '参数无效', details?: unknown) =>
    fail(API_ERROR_CODES.INVALID_INPUT, msg, { requestId, details }),
  featureNotFound: (requestId: string, msg = '功能不存在') =>
    fail(API_ERROR_CODES.FEATURE_NOT_FOUND, msg, { requestId }),
  featureDisabled: (requestId: string, msg = '功能已禁用') =>
    fail(API_ERROR_CODES.FEATURE_DISABLED, msg, { requestId }),
  insufficientPower: (requestId: string, msg = '算力不足') =>
    fail(API_ERROR_CODES.INSUFFICIENT_POWER, msg, { requestId }),
  duplicateRequest: (requestId: string, msg = '重复请求') =>
    fail(API_ERROR_CODES.DUPLICATE_REQUEST, msg, { requestId }),
  taskNotFound: (requestId: string, msg = '任务不存在') =>
    fail(API_ERROR_CODES.TASK_NOT_FOUND, msg, { requestId }),
  providerUnavailable: (requestId: string, msg = 'AI 服务不可用') =>
    fail(API_ERROR_CODES.PROVIDER_UNAVAILABLE, msg, { requestId }),
  rateLimited: (requestId: string, msg = '请求过于频繁') =>
    fail(API_ERROR_CODES.RATE_LIMITED, msg, { requestId }),
  internalError: (requestId: string, msg = '服务器内部错误', details?: unknown) =>
    fail(API_ERROR_CODES.INTERNAL_ERROR, msg, { requestId, details }),
};
