/**
 * 认证工具函数
 * 密码哈希、JWT生成与验证
 */

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { assertTokenVersion } from '@/lib/token-version';

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || '';

// ==================== 启动时校验 ====================

const DANGEROUS_DEFAULTS = [
  'your-super-secret-key-change-in-production',
  'your-super-secret-jwt-key-change-me',
  'change-me',
  'secret',
  '123456',
];

function validateJwtSecret(): void {
  if (!JWT_SECRET || JWT_SECRET.trim() === '') {
    throw new Error('[Auth] JWT_SECRET 未配置！生产环境必须设置一个随机的 JWT 密钥。');
  }
  if (DANGEROUS_DEFAULTS.includes(JWT_SECRET.trim())) {
    throw new Error('[Auth] JWT_SECRET 使用了默认占位符！生产环境禁止使用默认值，请生成随机字符串。');
  }
  if (JWT_SECRET.length < 32) {
    throw new Error('[Auth] JWT_SECRET 长度不足！建议至少 32 个字符。');
  }
}

// 仅在服务器端（非 Next.js 客户端）执行校验
if (typeof window === 'undefined') {
  try {
    validateJwtSecret();
  } catch (err) {
    // 避免在客户端打包时崩溃，只在服务器真正启动时触发
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ ', (err as Error).message);
      process.exit(1);
    } else {
      console.warn('⚠️ ', (err as Error).message, '(开发环境跳过校验)');
    }
  }
}

// 将密钥转换为 Uint8Array
function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET);
}

// JWT 过期时间（7天）
const JWT_EXPIRES_IN = '7d';

// ==================== 密码相关 ====================

/**
 * 哈希密码
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * 验证密码
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ==================== JWT 相关 ====================

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  /** JWT 撤销版本号：等于 users.token_version，logout 时 ++ */
  ver: number;
}

/**
 * 生成 JWT Token
 */
export async function generateToken(payload: JwtPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRES_IN)
    .sign(getSecretKey());

  return token;
}

/**
 * 验证 JWT Token
 * 流程：jose 验签 + 过期检查 → DB 比对 token_version（撤销机制）
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  let payload: JwtPayload;
  try {
    const { payload: raw } = await jwtVerify(token, getSecretKey());
    payload = raw as unknown as JwtPayload;
  } catch (error) {
    console.error('JWT验证失败:', error);
    return null;
  }
  // 撤销检查：DB 中 users.token_version 必须等于 JWT.ver
  if (!(await assertTokenVersion(payload.userId, payload.ver))) {
    return null;
  }
  return payload;
}

// ==================== 会话管理 ====================

/**
 * 从请求中提取 Token
 */
export function extractTokenFromRequest(request: Request): string | null {
  // 从 Authorization header 提取
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  // 从 Cookie 提取（支持 auth_token 和 legacy token）
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const pairs = cookieHeader.split(';').map(c => {
      const idx = c.indexOf('=');
      return idx >= 0 ? [c.substring(0, idx).trim(), c.substring(idx + 1).trim()] : null;
    }).filter(Boolean) as [string, string][];
    const cookies = Object.fromEntries(pairs);
    return cookies.auth_token || cookies.token || null;
  }
  
  return null;
}

/**
 * 获取当前用户
 */
export async function getCurrentUser(request: Request): Promise<JwtPayload | null> {
  const token = extractTokenFromRequest(request);
  if (!token) return null;
  
  return verifyToken(token);
}

/**
 * 要求用户已登录（否则返回 401）
 * 用于 API 路由入口保护
 */
export async function requireAuth(request: Request): Promise<JwtPayload | null> {
  const user = await getCurrentUser(request);
  return user;
}
