/**
 * Rate Limiter — 内存版，基于 IP 限速
 *
 * 使用方式：
 *   import { rateLimit } from '@/lib/rate-limit'
 *   const { success, remaining, reset } = await rateLimit(ip, { limit: 30, window: 5 * 60 * 1000 })
 *   if (!success) return rateLimitResponse(rl)
 */

// =====================
// 兼容层：兼容旧版 proxy.ts 的 createRateLimiter 接口
// =====================

interface LegacyRateLimiterOptions {
  windowMs: number
  max: number
  keyPrefix: string
  perPath?: boolean
}

interface LegacyRateLimitResult {
  allowed: boolean
  response?: Response
  headers: Record<string, string>
  remaining: number
  reset: number
}

/**
 * 兼容 createRateLimiter（proxy.ts 用）
 * @deprecated 请使用新的 rateLimit() 函数
 */
export function createRateLimiter(options: LegacyRateLimiterOptions) {
  const { windowMs, max, keyPrefix, perPath = false } = options
  const store = new Map<string, { count: number; resetAt: number }>()

  return async function (request: Request): Promise<LegacyRateLimitResult> {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? request.headers.get('x-real-ip')?.trim()
      ?? '127.0.0.1'
    const path = perPath ? new URL(request.url).pathname : keyPrefix
    const key = `${keyPrefix}:${ip}:${path}`
    const now = Date.now()

    const record = store.get(key)
    if (!record || record.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs })
      return {
        allowed: true,
        headers: {
          'X-RateLimit-Limit': String(max),
          'X-RateLimit-Remaining': String(max - 1),
          'X-RateLimit-Reset': String(Math.floor((now + windowMs) / 1000)),
        },
        remaining: max - 1,
        reset: Math.floor((now + windowMs) / 1000),
      }
    }

    if (record.count >= max) {
      return {
        allowed: false,
        response: new Response(JSON.stringify({ error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
        headers: {
          'X-RateLimit-Limit': String(max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(record.resetAt / 1000)),
        },
        remaining: 0,
        reset: Math.floor(record.resetAt / 1000),
      }
    }

    record.count++
    return {
      allowed: true,
      headers: {
        'X-RateLimit-Limit': String(max),
        'X-RateLimit-Remaining': String(max - record.count),
        'X-RateLimit-Reset': String(Math.floor(record.resetAt / 1000)),
      },
      remaining: max - record.count,
      reset: Math.floor(record.resetAt / 1000),
    }
  }
}

// =====================
// 新版 API
// =====================

interface RateLimitOptions {
  /** 时间窗口内最多请求次数 */
  limit: number
  /** 时间窗口（毫秒），默认 5 分钟 */
  window?: number
}

interface RateLimitResult {
  /** 是否通过 */
  success: boolean
  /** 剩余可用次数 */
  remaining: number
  /** 窗口重置时间戳（秒） */
  reset: number
  /** 总限制次数 */
  limit: number
}

// 内存存储：key = IP 地址，value = { count, resetAt }
const store = new Map<string, { count: number; resetAt: number }>()

// 定期清理过期数据（每 10 分钟）
const CLEANUP_INTERVAL = 10 * 60 * 1000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, val] of store.entries()) {
    if (val.resetAt < now) store.delete(key)
  }
}

/**
 * 获取请求 IP
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()

  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP.trim()

  return '127.0.0.1'
}

/**
 * 限速检查（任务7：Redis 优先，多实例共享；Redis 不可用降级内存）
 *
 * 策略：
 *   1. 生产环境（NODE_ENV=production）且 Redis 可用 → INCR + EXPIRE 原子计数（多容器共享）
 *   2. Redis 不可用 → 内存 Map 降级（单实例，fail-open 语义：不阻断业务）
 */
export async function rateLimit(
  identifier: string,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { limit, window = 5 * 60 * 1000 } = options
  const now = Date.now()
  const windowSec = Math.ceil(window / 1000)

  // 1. Redis 优先（生产环境多实例共享；开发环境有 Redis 也走，无则内存）
  try {
    const { getRedis } = await import('@/lib/redis')
    const redis = getRedis()
    const key = `ratelimit:${identifier}`
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, windowSec)
    }
    return {
      success: count <= limit,
      remaining: Math.max(0, limit - count),
      reset: Math.floor((now + window) / 1000),
      limit,
    }
  } catch {
    // Redis 不可用 → 内存降级
  }

  // 2. 内存降级（单实例）
  cleanup()

  const record = store.get(identifier)

  // 无记录 或 已过期 → 新建窗口
  if (!record || record.resetAt < now) {
    store.set(identifier, {
      count: 1,
      resetAt: now + window,
    })
    return {
      success: true,
      remaining: limit - 1,
      reset: Math.floor((now + window) / 1000),
      limit,
    }
  }

  // 已超限
  if (record.count >= limit) {
    return {
      success: false,
      remaining: 0,
      reset: Math.floor(record.resetAt / 1000),
      limit,
    }
  }

  // 通过，计数 +1
  record.count++
  return {
    success: true,
    remaining: limit - record.count,
    reset: Math.floor(record.resetAt / 1000),
    limit,
  }
}

/**
 * 生成 429 Too Many Requests 响应
 */
export function rateLimitResponse(result: RateLimitResult) {
  return new Response(
    JSON.stringify({
      success: false,
      error: '请求过于频繁，请稍后再试',
      code: 'RATE_LIMITED',
      remaining: result.remaining,
      reset: result.reset,
      limit: result.limit,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, result.reset - Math.floor(Date.now() / 1000))),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.reset),
      },
    }
  )
}

/** 常用限速预设（可按需调整） */
// 登录注册：严格限制，5 分钟 10 次（生产）
// dev/test 环境：放宽到 10000 次（避免 e2e 测试与本地开发被误伤）
const IS_PROD = process.env.NODE_ENV === 'production';
export const AUTH_LIMIT = IS_PROD
  ? { limit: 10, window: 5 * 60 * 1000 }
  : { limit: 10000, window: 5 * 60 * 1000 };
// 通用 API：5 分钟 60 次
export const API_LIMIT = IS_PROD
  ? { limit: 60, window: 5 * 60 * 1000 }
  : { limit: 100000, window: 5 * 60 * 1000 };
// 敏感操作（上传/生成）：5 分钟 30 次
export const WRITE_LIMIT = IS_PROD
  ? { limit: 30, window: 5 * 60 * 1000 }
  : { limit: 100000, window: 5 * 60 * 1000 };
// 宽松限制：5 分钟 300 次
export const LOOSE_LIMIT = IS_PROD
  ? { limit: 300, window: 5 * 60 * 1000 }
  : { limit: 1000000, window: 5 * 60 * 1000 };
