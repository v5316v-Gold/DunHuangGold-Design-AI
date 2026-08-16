import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, generateToken } from '@/lib/auth';
import { db, users } from '@/storage/database/db';
import { eq } from 'drizzle-orm';
import { rateLimit, getClientIP, AUTH_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { randomUUID } from 'crypto';
import { captureError, setSentryUser } from '@/lib/sentry/capture';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

/**
 * 用户注册
 * POST /api/auth/register
 * Body: { email, password, nickname? }
 */
export async function POST(request: NextRequest) {
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: "数据库未配置" }, { status: 503 });

  // Rate Limit：同一 IP 5分钟最多10次
  const ip = getClientIP(request);
  const rl = await rateLimit(ip, AUTH_LIMIT);
  if (!rl.success) return rateLimitResponse(rl);
  try {
    const body = await request.json();
    const { email, password, nickname } = body;

    // 参数验证
    if (!email || !password) {
      return NextResponse.json(
        {  error: '邮箱和密码为必填项' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {  error: '密码长度至少6位' },
        { status: 400 }
      );
    }

    // 检查邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        {  error: '邮箱格式不正确' },
        { status: 400 }
      );
    }

    // 使用 Drizzle 检查用户是否已存在
    const existingUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUsers.length > 0) {
      return NextResponse.json(
        {  error: '该邮箱已被注册' },
        { status: 409 }
      );
    }

    // 哈希密码
    const passwordHash = await hashPassword(password);

    // 使用 Drizzle 插入用户
    const newUserList = await db
      .insert(users)
      .values({
        email,
        nickname: nickname || email.split('@')[0],
        passwordHash: passwordHash,
        role: 'user',
        power: 100,
      })
      .returning({
        id: users.id,
        email: users.email,
        nickname: users.nickname,
        role: users.role,
        power: users.power,
        tokenVersion: users.tokenVersion,
      });

    const newUser = newUserList[0];

    // 生成 Token（ver 字段：撤销机制，新用户从 0 开始）
    const token = await generateToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      ver: (newUser as { tokenVersion?: number }).tokenVersion ?? 0,
    });

    const response = NextResponse.json({
      requestId: reqId(), success: true,
      data: {
        user: newUser,
        token,
      },
      message: '注册成功',
    });

    // 设置 HttpOnly Cookie（Secure 仅在生产 HTTPS 部署时启用）
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    // Sentry 用户追踪（关联用户行为）
    void setSentryUser({ id: newUser.id, email: newUser.email, username: newUser.nickname || undefined });

    return response;
  } catch (error) {
    console.error('注册失败:', error);
    void captureError(error, { tags: { route: 'POST /api/auth/register' }, level: 'error' });
    return NextResponse.json(
      {  error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
