/**
 * 安全验证工具
 * 提供 API Key 验证和 Prompt 注入防护
 */

import { createLogger } from './error-handler';

const logger = createLogger('security');

// Prompt 注入风险模式
const INJECTION_PATTERNS = [
  // 系统提示词注入
  /^(system|prompt|instructions?):/im,
  // JSON/YAML 注入
  /^\s*[{[]/m,
  // 编程语言注入
  /^(import|export|function|class|def|const|let|var)\s/m,
  // Shell 命令注入
  /^[|;&`$]/m,
  // URL/编码注入
  /%[0-9a-f]{2}/im,
  // SQL 注入模式
  /('|--|;| DROP | INSERT | UPDATE | DELETE | UNION)/im,
  // XML/HTML 注入
  /<\?xml|<!DOCTYPE|<html/im,
  // CSS 注入
  /@import|expression\s*\(|url\s*\(/im,
  // 逃逸尝试
  /\\[nrt]|\\x[0-9a-f]{2}/im,
];

// 可疑字符模式
const SUSPICIOUS_CHARS = [
  /\x00/, // 空字节
  /\x1b/, // ESC
 /\xfe/, // BOM
];

// 信任的 API 提供商前缀（防止误报）
const TRUSTED_PROVIDER_PREFIXES = [
  'sk-',        // OpenAI
  'zm-',        // 智谱AI
  'db-',        // 豆包
  'mm-',        // MiniMax
  'qw-',        // Qwen
  'mk-',        // Moonshot/Kimi
  'AI-',        // Anthropic
  'gpte_',      // Generic API Key
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * 验证 API Key 格式
 */
export function validateApiKey(apiKey: string | undefined | null): ValidationResult {
  if (!apiKey) {
    return { valid: false, error: 'API Key 不能为空' };
  }

  const trimmed = apiKey.trim();
  
  if (trimmed.length < 10) {
    return { valid: false, error: 'API Key 长度不足' };
  }

  // 检查是否为占位符
  if (trimmed.startsWith('YOUR_') || trimmed.includes('...')) {
    return { valid: false, error: '请配置真实的 API Key' };
  }

  // 检查是否包含明显的路径
  if (trimmed.includes('/') && !trimmed.startsWith('sk-')) {
    return { valid: false, error: 'API Key 格式无效' };
  }

  // 检查是否包含可疑字符
  for (const pattern of SUSPICIOUS_CHARS) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'API Key 包含非法字符' };
    }
  }

  return { valid: true };
}

/**
 * 验证 Prompt 是否包含注入风险
 */
export function validatePrompt(prompt: string | undefined | null): ValidationResult {
  const warnings: string[] = [];
  
  if (!prompt) {
    return { valid: true }; // 空 prompt 在某些场景是允许的
  }

  const trimmed = prompt.trim();
  
  if (trimmed.length === 0) {
    return { valid: true };
  }

  // 检查注入模式
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      // 如果匹配到可信前缀，则不是注入
      const matched = trimmed.match(pattern);
      if (matched) {
        const prefix = matched[0];
        const isTrusted = TRUSTED_PROVIDER_PREFIXES.some(p => prefix.includes(p));
        if (isTrusted) {
          continue;
        }
      }
      
      warnings.push(`检测到可疑模式: ${pattern.source}`);
      logger.warn('Prompt 注入风险', { pattern: pattern.source });
    }
  }

  // 检查长度限制
  if (trimmed.length > 10000) {
    warnings.push('Prompt 过长，可能影响生成质量');
  }

  // 检查重复模式（可能的恶意注入）
  const repeats = trimmed.match(/(.{3,})\1{5,}/g);
  if (repeats) {
    warnings.push('检测到重复字符模式');
  }

  return {
    valid: true, // 只有错误才阻止，警告只记录
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 清理 Prompt（移除潜在的注入内容）
 */
export function sanitizePrompt(prompt: string): string {
  if (!prompt) return prompt;
  
  let cleaned = prompt.trim();
  
  // 移除常见的注入前缀
  const prefixesToRemove = [
    /^system:\s*/i,
    /^prompt:\s*/i,
    /^instructions?:\s*/i,
    /^you are:\s*/i,
    /^as a:\s*/i,
    /^roleplay:\s*/i,
  ];
  
  for (const prefix of prefixesToRemove) {
    cleaned = cleaned.replace(prefix, '');
  }
  
  // 移除多余的空白
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * 验证文件类型
 */
export function validateFileType(
  filename: string, 
  allowedTypes: string[] = ['jpg', 'jpeg', 'png', 'gif', 'webp']
): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? allowedTypes.includes(ext) : false;
}

/**
 * 验证文件大小
 */
export function validateFileSize(
  size: number, 
  maxSizeMB: number = 10
): boolean {
  return size <= maxSizeMB * 1024 * 1024;
}

/**
 * 速率限制辅助 - 可插拔架构
 * 生产环境建议使用 Redis：设置 REDIS_URL 环境变量即可启用
 */
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number; // 秒
}

// Redis 客户端工厂（延迟加载）
let redisClient: ReturnType<typeof createRedisClient> | null = null;

function createRedisClient() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Redis = require('ioredis');
  return new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times: number) {
      if (times > 1) return null;
      return Math.min(times * 100, 1000);
    },
  });
}

function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  if (!redisClient) {
    try {
      redisClient = createRedisClient();
    } catch {
      return null;
    }
  }
  return redisClient;
}

/**
 * 检查速率限制（自动选择 Redis 或内存）
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60000
): Promise<RateLimitResult> {
  const redis = getRedisClient();

  if (redis) {
    try {
      return await checkRateLimitRedis(redis, identifier, maxRequests, windowMs);
    } catch {
      // Redis 失败，降级到内存
    }
  }

  return checkRateLimitMemory(identifier, maxRequests, windowMs);
}

/**
 * Redis 速率限制（滑动窗口）
 */
async function checkRateLimitRedis(
  redis: ReturnType<typeof createRedisClient>,
  identifier: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  const now = Date.now();
  const windowSec = Math.ceil(windowMs / 1000);

  const multi = redis.multi();
  multi.zremrangebyscore(key, 0, now - windowMs);
  multi.zadd(key, now, `${now}-${Math.random()}`);
  multi.zcard(key);
  multi.expire(key, windowSec);

  const results = await multi.exec();
  if (!results) {
    throw new Error('Redis exec failed');
  }

  const count = results[2][1] as number;

  if (count > maxRequests) {
    const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
    const resetIn = oldest.length >= 2
      ? Math.ceil((parseInt(oldest[1]) + windowMs - now) / 1000)
      : windowSec;
    return { allowed: false, remaining: 0, resetIn };
  }

  return {
    allowed: true,
    remaining: maxRequests - count,
    resetIn: windowSec,
  };
}

/**
 * 内存速率限制（回退方案）
 */
function checkRateLimitMemory(
  identifier: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const record = requestCounts.get(identifier);

  if (!record || now > record.resetTime) {
    requestCounts.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetIn: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((record.resetTime - now) / 1000),
    };
  }

  record.count++;

  return {
    allowed: true,
    remaining: maxRequests - record.count,
    resetIn: Math.ceil((record.resetTime - now) / 1000),
  };
}
