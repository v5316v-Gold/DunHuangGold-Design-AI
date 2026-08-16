import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { extractTokenFromRequest, verifyToken } from '@/lib/auth';
import { bumpTokenVersion } from '@/lib/token-version';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

/**
 * 用户登出
 * POST /api/auth/logout
 * ① 撤销该用户所有有效 JWT（自增 users.token_version，之前签发的 token 立即作废）
 * ② 清除客户端 auth_token Cookie
 *
 * 即使攻击者拿到旧 token，也无法继续使用（DB 中 ver 已被 ++，verifyToken 拒绝）
 */
export async function POST(request: Request) {
  // 撤销：自增 token_version（不依赖 cookie 是否在 — 优先用 Authorization 头解析 userId）
  const token = extractTokenFromRequest(request);
  if (token) {
    const payload = await verifyToken(token);
    if (payload?.userId) {
      await bumpTokenVersion(payload.userId);
    }
  }

  const response = NextResponse.json({
    requestId: reqId(), success: true,
    message: '登出成功',
  });

  // 清除 auth_token Cookie
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
