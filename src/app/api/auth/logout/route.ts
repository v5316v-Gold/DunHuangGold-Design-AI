import { NextResponse } from 'next/server';

/**
 * 用户登出
 * POST /api/auth/logout
 * 清除 auth_token Cookie
 */
export async function POST() {
  const response = NextResponse.json({
    success: true,
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
