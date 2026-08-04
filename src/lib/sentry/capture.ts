/**
 * Phase 9.13 · Sentry 错误捕获工具（API/Worker 通用）
 *
 * 用法：
 *   import { captureError, captureMessage } from '@/lib/sentry/capture';
 *
 * - captureError(err, context): 捕获异常（含 cause/stack + user/IP/路由上下文）
 * - captureMessage(msg, level): 主动上报消息
 * - setSentryUser(userId, email): 关联用户上下文（auth 流程）
 * - setSentryRequestContext(req): 关联请求上下文
 *
 * 无 SENTRY_DSN 时退化为 console（不抛错、不影响主流程）
 */

import type { NextRequest } from 'next/server';

interface CaptureContext {
  tags?: Record<string, string | number | boolean>;
  extra?: Record<string, unknown>;
  level?: 'info' | 'warning' | 'error';
  user?: { id?: string; email?: string; username?: string };
  request?: NextRequest;
}

/** 当前请求的 Sentry 上下文（thread-local 模式） */
let currentRequest: NextRequest | null = null;

export function setSentryRequestContext(req: NextRequest) {
  currentRequest = req;
}

export function clearSentryRequestContext() {
  currentRequest = null;
}

/** 关联当前用户（Sentry 用户追踪） */
export async function setSentryUser(user: { id?: string; email?: string; username?: string }) {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  } catch {
    // 静默
  }
}

/** 清除用户上下文（登出时） */
export async function clearSentryUser() {
  if (!process.env.SENTRY_DSN) return;
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.setUser(null);
  } catch {
    // 静默
  }
}

/**
 * 自动提取 IP/路由/UA 等上下文
 */
function extractRequestContext(req?: NextRequest) {
  const ctx: Record<string, unknown> = {};
  const r = req || currentRequest;
  if (!r) return ctx;

  try {
    ctx.url = r.nextUrl?.pathname || r.url;
    ctx.method = r.method;

    // IP（优先 X-Real-IP，回退 X-Forwarded-For）
    const ip =
      r.headers.get('x-real-ip') ||
      r.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      'unknown';
    ctx.ip = ip;

    // UA
    const ua = r.headers.get('user-agent');
    if (ua) ctx.userAgent = ua;

    // 关键 headers（脱敏后）
    ctx.referer = r.headers.get('referer');
  } catch {
    // 静默
  }
  return ctx;
}

/** 自动 PII 脱敏：邮箱、token、密码 */
function sanitizeExtra(extra?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!extra) return undefined;
  const SENSITIVE_KEYS = ['password', 'token', 'apikey', 'api_key', 'secret', 'jwt', 'authorization', 'cookie'];
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) {
    const lower = k.toLowerCase();
    if (SENSITIVE_KEYS.some((s) => lower.includes(s))) {
      result[k] = '[REDACTED]';
    } else if (typeof v === 'string' && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)) {
      // 整字段是邮箱 → 整字段脱敏
      result[k] = '***@***';
    } else if (typeof v === 'string') {
      // 字符串中嵌入邮箱 → 部分脱敏（保留首 2 字符 + @***）
      result[k] = v.replace(
        /([a-zA-Z0-9._%+-]{1,2})[a-zA-Z0-9._%+-]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
        '$1***$2'
      );
    } else {
      result[k] = v;
    }
  }
  return result;
}

export async function captureError(error: unknown, context?: CaptureContext) {
  const errObj = error instanceof Error ? error : new Error(String(error));

  // 始终本地打印（不丢上下文）
  console.error('[captureError]', errObj.message, context?.tags || '');

  if (!process.env.SENTRY_DSN) return;

  try {
    const Sentry = await import('@sentry/nextjs');
    const requestCtx = extractRequestContext(context?.request);
    const sanitizedExtra = sanitizeExtra({ ...requestCtx, ...context?.extra });

    if (context?.user) {
      Sentry.setUser({
        id: context.user.id,
        email: context.user.email,
        username: context.user.username,
      });
    }

    Sentry.captureException(errObj, {
      tags: context?.tags,
      extra: sanitizedExtra,
      level: context?.level || 'error',
    });
  } catch (e) {
    console.error('[Sentry] captureError 失败:', e);
  }
}

export async function captureMessage(message: string, context?: CaptureContext) {
  if (!process.env.SENTRY_DSN) {
    console.log('[captureMessage]', message, context?.tags || '');
    return;
  }

  try {
    const Sentry = await import('@sentry/nextjs');
    const requestCtx = extractRequestContext(context?.request);
    const sanitizedExtra = sanitizeExtra({ ...requestCtx, ...context?.extra });

    if (context?.user) {
      Sentry.setUser({
        id: context.user.id,
        email: context.user.email,
        username: context.user.username,
      });
    }

    Sentry.captureMessage(message, {
      level: context?.level || 'info',
      tags: context?.tags,
      extra: sanitizedExtra,
    });
  } catch (e) {
    console.error('[Sentry] captureMessage 失败:', e);
  }
}