/**
 * Phase 5.6 · PG 自动重连（Repository 层 retry middleware）
 *
 * 解决 Phase 1 发现：PG 重启后 drizzle pool 不自动重连。
 * 策略：指数退避重试（默认 3 次），仅在"连接类错误"（ECONNREFUSED / Connection terminated /
 * 57P01 admin shutdown / 57P02 crash / 57P03 cannot connect now）时重试，
 * 业务错误（唯一约束冲突等）直接抛出。
 */

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  backoffFactor?: number;
  /** 自定义错误是否可重试判定（默认按连接错误码） */
  isRetryable?: (error: unknown) => boolean;
}

const DEFAULTS: Required<Omit<RetryOptions, 'isRetryable'>> = {
  maxRetries: 3,
  baseDelayMs: 500,
  backoffFactor: 2,
};

/** PostgreSQL 连接类错误码（重试有意义） */
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  '57P01', // admin_shutdown
  '57P02', // crash_shutdown
  '57P03', // cannot_connect_now
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08006', // connection_failure
  '53300', // too_many_connections
]);

function isConnectionError(error: unknown): boolean {
  const e = error as { code?: string; message?: string };
  if (e?.code && CONNECTION_ERROR_CODES.has(e.code)) return true;
  const msg = e?.message ?? String(error);
  return (
    msg.includes('Connection terminated') ||
    msg.includes('connection refused') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('pool is closed') ||
    msg.includes('Client has encountered a connection error')
  );
}

/**
 * 带重试的 DB 操作包装
 *
 * @example
 * const rows = await withRetry(() => db.select().from(tasks).where(...));
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const cfg = { ...DEFAULTS, ...options };
  const isRetryable = options.isRetryable ?? isConnectionError;

  let lastError: unknown;
  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === cfg.maxRetries) {
        throw error;
      }
      const delay = cfg.baseDelayMs * Math.pow(cfg.backoffFactor, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export { isConnectionError };
