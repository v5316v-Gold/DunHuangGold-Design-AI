import { NextRequest, NextResponse } from 'next/server';
import { hashPassword, generateToken } from '@/lib/auth';
import { db, users } from '@/storage/database/db';
import { eq } from 'drizzle-orm';
import { rateLimit, getClientIP, AUTH_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * 用户注册
 * POST /api/auth/register
 * Body: { email, password, nickname? }
 */
export async function POST(request: NextRequest) {
  if (!db) return NextResponse.json({ success: false, error: "数据库未配置" }, { status: 503 });

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
        { error: '邮箱和密码为必填项' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '密码长度至少6位' },
        { status: 400 }
      );
    }

    // 检查邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '邮箱格式不正确' },
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
        { error: '该邮箱已被注册' },
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
      });

    const newUser = newUserList[0];

    // 生成 Token
    const token = await generateToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        user: newUser,
        token,
      },
      message: '注册成功',
    });

    // 设置 HttpOnly Cookie
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('注册失败:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
