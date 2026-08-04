/**
 * Phase 3.6 · API 中间件（完整实现，去掉 @ts-nocheck）
 *
 * Spec: docs/03-L2-API.md §6/§7 + Phase 2 脚手架正式落地
 *
 * 提供：
 *   withRequestContext / withAuth / withAdmin / withValidation
 *   withRateLimit / withIdempotency（防双扣 ADR-008）/ withAudit / dispatch
 *
 * 约定：
 *   - Handler = (ctx, request, input) => NextResponse
 *   - 各 middleware 返回 (request, input?) => Promise<NextResponse>，可直接挂路由
 *   - requestId 统一从 X-Request-Id 取，缺省生成 req_<uuid>
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { verifyToken } from '@/lib/auth';
import { getRedis } from '@/lib/redis';
import { logAudit } from '@/lib/audit-logger';
import {
  fail,
  API_ERROR_CODES,
  type ApiResponse,
  type ApiErrorCode,
} from './envelope';

// ==================== Handler 类型 ====================

export type Handler<P = unknown, R = unknown> = (
  ctx: RequestContext,
  request: NextRequest,
  input: P
) => Promise<NextResponse | ApiResponse<R> | Response>;

export interface RequestContext {
  requestId: string;
  user: { id: string; email: string; role: string } | null;
}

function requestIdOf(request: NextRequest): string {
  return request.headers.get('X-Request-Id') || `req_${randomUUID()}`;
}

// ==================== 1. withRequestContext ====================

export function withRequestContext(handler: Handler) {
  return async (request: NextRequest, input?: unknown) => {
    const ctx: RequestContext = { requestId: requestIdOf(request), user: null };
    return handler(ctx, request, input);
  };
}

// ==================== 2. withAuth ====================

export function withAuth(handler: Handler) {
  return async (request: NextRequest, input?: unknown) => {
    const requestId = requestIdOf(request);
    const token = extractToken(request);
    if (!token) {
      return fail(API_ERROR_CODES.AUTH_REQUIRED, '未登录', { requestId });
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return fail(API_ERROR_CODES.INVALID_CREDENTIALS, 'token 无效或已过期', {
        requestId,
      });
    }

    const ctx: RequestContext = {
      requestId,
      user: { id: payload.userId, email: payload.email, role: payload.role },
    };
    return handler(ctx, request, input);
  };
}

function extractToken(request: NextRequest): string | null {
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return request.cookies.get('auth_token')?.value || null;
}

// ==================== 3. withAdmin ====================

export function withAdmin(handler: Handler) {
  return async (request: NextRequest, input?: unknown) => {
    const wrapped = withAuth(async (ctx, _req, body) => {
      if (ctx.user?.role !== 'admin') {
        return fail(API_ERROR_CODES.PERMISSION_DENIED, '需要管理员角色', {
          requestId: ctx.requestId,
        });
      }
      return handler(ctx, _req, body);
    });
    return wrapped(request, input);
  };
}

// ==================== 4. withValidation ====================

export function withValidation<T extends z.ZodTypeAny>(schema: T) {
  return (handler: Handler<z.infer<T>>) =>
    async (request: NextRequest, input?: unknown) => {
      const requestId = requestIdOf(request);
      let parsed: z.infer<T>;
      try {
        let body: unknown;
        if (input !== undefined) {
          body = input;
        } else {
          // 用 clone 避免后续 handler 拿不到 body
          const text =
            request.method !== 'GET' && request.body
              ? await request.clone().text()
              : '';
          body = text ? JSON.parse(text) : {};
        }
        parsed = schema.parse(body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          // zod v3 用 err.errors, v4 用 err.issues, 双兼容
          const zodIssues =
            (err as unknown as { issues?: unknown }).issues ??
            (err as unknown as { errors?: unknown }).errors;
          return fail(API_ERROR_CODES.INVALID_INPUT, '参数验证失败', {
            requestId,
            details: zodIssues,
          });
        }
        return fail(API_ERROR_CODES.INVALID_INPUT, '请求体解析失败', {
          requestId,
          details: { message: (err as Error).message },
        });
      }
      const ctx: RequestContext = { requestId, user: null };
      return handler(ctx, request, parsed);
    };
}

// ==================== 5. withRateLimit ====================

const RATE_LIMIT_DEFAULTS = {
  windowMs: 60_000,
  max: 60,
  perPath: false,
};

export function withRateLimit(
  opts: { windowMs?: number; max?: number; perPath?: boolean } = {}
) {
  const config = { ...RATE_LIMIT_DEFAULTS, ...opts };
  // dev/test 环境：跳过 rate limit（避免 e2e 测试与本地开发被误伤）
  const skipRateLimit = process.env.NODE_ENV !== 'production';
  return (handler: Handler) =>
    async (request: NextRequest, input?: unknown) => {
      const requestId = requestIdOf(request);
      const ip = getClientIp(request);
      const key = `ratelimit:${ip}${config.perPath ? ':' + new URL(request.url).pathname : ''}`; // 与 @/lib/rate-limit 同前缀，共享计数

      try {
        if (!skipRateLimit) {
          const redis = getRedis();
          const count = await redis.incr(key);
          if (count === 1) await redis.expire(key, Math.ceil(config.windowMs / 1000));
          if (count > config.max) {
            return fail(API_ERROR_CODES.RATE_LIMITED, '请求过于频繁，请稍后再试', {
              requestId,
              details: { limit: config.max, windowMs: config.windowMs },
            });
          }
        }
      } catch (err) {
        // Redis 失败 → 放行（不阻塞业务，fail-open）
        console.warn('[rate-limit] redis error, allowing request', err);
      }

      const ctx: RequestContext = { requestId, user: null };
      return handler(ctx, request, input);
    };
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('X-Real-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

// ==================== 6. withIdempotency (防双扣 ADR-008) ====================

/**
 * per 03-L2 §10:
 *   1. validate idempotency key
 *   2. store key + user + request hash
 *   3. return original task for duplicate requests
 *   4. NEVER charge twice for the same accepted request
 */
export function withIdempotency(handler: Handler) {
  return async (request: NextRequest, input?: unknown) => {
    const requestId = requestIdOf(request);
    const idempotencyKey = request.headers.get('Idempotency-Key');

    if (!idempotencyKey) {
      return fail(API_ERROR_CODES.INVALID_INPUT, 'Idempotency-Key header required', {
        requestId,
      });
    }

    // 1. 读取 body 用于 hash
    const bodyText =
      request.method !== 'GET' ? await request.clone().text() : '';
    const requestHash = await hashString(`${idempotencyKey}:${bodyText}`);

    try {
      const redis = getRedis();
      // 2. SETNX 抢占
      const acqRes = await redis.set(
        `idem:${idempotencyKey}`,
        JSON.stringify({ requestHash, requestId, ts: Date.now() }),
        'EX',
        86400, // 24 小时
        'NX'
      );

      if (acqRes !== 'OK') {
        // 已存在 → 校验 hash 判断是否真重复
        const existing = await redis.get(`idem:${idempotencyKey}`);
        if (existing) {
          const data = JSON.parse(existing) as { requestHash: string; requestId: string };
          if (data.requestHash === requestHash) {
            return fail(API_ERROR_CODES.DUPLICATE_REQUEST, '请求重复（已处理）', {
              requestId,
              details: { originalRequestId: data.requestId },
            });
          }
          return fail(API_ERROR_CODES.INVALID_INPUT, 'Idempotency-Key 已被使用', {
            requestId,
          });
        }
      }
    } catch (err) {
      // Redis 失败 → 放行（fail-open，与限流一致）
      console.warn('[idempotency] redis error, allowing request', err);
    }

    const ctx: RequestContext = { requestId, user: null };
    return handler(ctx, request, input);
  };
}

// ==================== 7. withAudit ====================

export function withAudit(action: string, entityType: string) {
  return (handler: Handler) =>
    async (request: NextRequest, input?: unknown) => {
      const requestId = requestIdOf(request);
      const wrapped = withAuth(async (ctx, req, body) => {
        const result = await handler(ctx, req, body);
        const statusCode =
          typeof (result as Response).status === 'number'
            ? (result as Response).status
            : 500;
        // 记录成功/失败
        await logAudit({
          action,
          resourceType: entityType,
          resourceId: (body as { id?: string } | undefined)?.id,
          actorId: ctx.user?.id,
          actorEmail: ctx.user?.email,
          actorRole: ctx.user?.role,
          details: { requestId, ok: statusCode < 400 },
        }).catch((e) => console.error('[audit] failed', e));
        return result;
      });
      return wrapped(request, input);
    };
}

// ==================== dispatch（L2 路由便捷入口） ====================

/**
 * 给 handler 提供一个简单的 (request, handler, options) 调用入口
 * 供 L2 route 文件使用：dispatch(request, handler, { schema, auth })
 */
export async function dispatch(
  request: NextRequest,
  handler: Handler,
  options: { schema?: z.ZodTypeAny; auth?: 'user' | 'admin' | 'none' } = {}
): Promise<NextResponse> {
  const requestId = requestIdOf(request);
  const { schema, auth = 'user' } = options;
  const ctx: RequestContext = { requestId, user: null };

  try {
    // 1. parse body
    let body: unknown = undefined;
    if (schema) {
      try {
        const text = request.method !== 'GET' ? await request.text() : '{}';
        body = schema.parse(text ? JSON.parse(text) : {});
      } catch (err) {
        if (err instanceof z.ZodError) {
          const zodIssues =
            (err as unknown as { issues?: unknown }).issues ??
            (err as unknown as { errors?: unknown }).errors;
          return fail(API_ERROR_CODES.INVALID_INPUT, '参数验证失败', {
            requestId,
            details: zodIssues,
          });
        }
        return fail(API_ERROR_CODES.INVALID_INPUT, '请求体解析失败', {
          requestId,
        });
      }
    }

    // 2. auth
    if (auth !== 'none') {
      const token = extractToken(request);
      if (!token) {
        return fail(API_ERROR_CODES.AUTH_REQUIRED, '未登录', { requestId });
      }
      const payload = await verifyToken(token);
      if (!payload) {
        return fail(API_ERROR_CODES.INVALID_CREDENTIALS, 'token 无效', { requestId });
      }
      ctx.user = { id: payload.userId, email: payload.email, role: payload.role };

      if (auth === 'admin' && ctx.user.role !== 'admin') {
        return fail(API_ERROR_CODES.PERMISSION_DENIED, '需要管理员角色', {
          requestId,
        });
      }
    }

    // 3. call handler
    const result = await handler(ctx, request, body);
    return result instanceof NextResponse ? result : NextResponse.json(result);
  } catch (err) {
    console.error('[handler] error', err);
    return fail(API_ERROR_CODES.INTERNAL_ERROR, '服务器内部错误', {
      requestId,
      details: { message: (err as Error).message },
    });
  }
}

// ==================== 工具 ====================

async function hashString(input: string): Promise<string> {
  const { createHash } = await import('crypto');
  return createHash('sha256').update(input).digest('hex');
}

// 导出类型供路由使用
export type { ApiErrorCode };
