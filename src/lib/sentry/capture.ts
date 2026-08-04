/**
 * Phase 9.11 · Sentry 错误捕获工具（API/Worker 通用）
 *
 * 用法：
 *   import { captureError, captureMessage } from '@/lib/sentry/capture';
 *
 * - captureError(err, context): 捕获异常（含 cause/stack）
 * - captureMessage(msg, level): 主动上报消息
 *
 * 无 SENTRY_DSN 时退化为 console.error（不抛错、不影响主流程）
 */

interface CaptureContext {
  tags?: Record<string, string | number | boolean>;
  extra?: Record<string, unknown>;
  level?: 'info' | 'warning' | 'error';
}

export async function captureError(error: unknown, context?: CaptureContext) {
  const dsn = process.env.SENTRY_DSN;
  const errObj = error instanceof Error ? error : new Error(String(error));

  // 始终本地打印（不丢上下文）
  console.error('[captureError]', errObj.message, context?.tags || '');

  if (!dsn) return;

  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(errObj, {
      tags: context?.tags,
      extra: context?.extra,
      level: context?.level || 'error',
    });
  } catch (e) {
    console.error('[Sentry] captureError 失败:', e);
  }
}

export async function captureMessage(
  message: string,
  context?: CaptureContext
) {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.log('[captureMessage]', message, context?.tags || '');
    return;
  }

  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureMessage(message, {
      level: context?.level || 'info',
      tags: context?.tags,
      extra: context?.extra,
    });
  } catch (e) {
    console.error('[Sentry] captureMessage 失败:', e);
  }
}