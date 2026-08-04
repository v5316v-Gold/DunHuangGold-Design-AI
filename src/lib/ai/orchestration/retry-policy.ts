/**
 * Phase 4.3 · 重试策略（Retry Policy）
 *
 * Spec: 05-L3-Orchestration §7 + ADR-004（BullMQ 重试）
 *
 * 职责：决定某次失败是否可重试、重试次数、退避间隔。
 * 集成：BullMQ attempts/backoff 配置 + 任务状态机 failed → retrying → processing。
 */

// ==================== 错误分类 ====================

/** 失败是否可重试 */
export type RetryVerdict = 'retry' | 'dead_letter' | 'no_retry';

export interface RetryDecision {
  verdict: RetryVerdict;
  /** 建议重试次数（dead_letter 时为已耗尽） */
  attempt: number;
  /** 退避延迟 ms（下次重试前） */
  backoffMs: number;
}

export interface RetryPolicyOptions {
  maxRetries: number;
  baseDelayMs: number;
  /** 指数退避倍数 */
  backoffFactor: number;
}

const DEFAULTS: RetryPolicyOptions = {
  maxRetries: 3,
  baseDelayMs: 5_000,
  backoffFactor: 2,
};

/** 不可重试的错误码（参数错误等，重试无意义） */
const NON_RETRYABLE_CODES = new Set([
  'INVALID_INPUT',
  'FEATURE_NOT_FOUND',
  'FEATURE_DISABLED',
  'INSUFFICIENT_POWER',
  'PERMISSION_DENIED',
]);

/**
 * 判断失败是否可重试
 */
export function shouldRetry(
  errorCode: string | undefined,
  attempt: number,
  options?: Partial<RetryPolicyOptions>
): RetryDecision {
  const cfg = { ...DEFAULTS, ...options };

  if (!errorCode) {
    // 无错误码 → 未知失败，保守重试
    return decide(cfg, attempt);
  }
  if (NON_RETRYABLE_CODES.has(errorCode)) {
    return { verdict: 'no_retry', attempt, backoffMs: 0 };
  }
  return decide(cfg, attempt);
}

function decide(cfg: RetryPolicyOptions, attempt: number): RetryDecision {
  if (attempt >= cfg.maxRetries) {
    return { verdict: 'dead_letter', attempt, backoffMs: 0 };
  }
  const backoffMs = cfg.baseDelayMs * Math.pow(cfg.backoffFactor, attempt);
  return { verdict: 'retry', attempt, backoffMs };
}

/** BullMQ 默认任务配置（对齐 task-queue.ts） */
export function bullmqRetryOptions(options?: Partial<RetryPolicyOptions>) {
  const cfg = { ...DEFAULTS, ...options };
  return {
    attempts: cfg.maxRetries + 1,
    backoff: { type: 'exponential' as const, delay: cfg.baseDelayMs },
  };
}

export const RETRY_POLICY_DEFAULTS = DEFAULTS;
