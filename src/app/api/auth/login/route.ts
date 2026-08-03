import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, generateToken } from '@/lib/auth';
import { db, users } from '@/storage/database/db';
import { memoryDb } from '@/storage/database/memory-db';
import { eq } from 'drizzle-orm';
import { rateLimit, getClientIP, AUTH_LIMIT, rateLimitResponse } from '@/lib/rate-limit';

/**
 * 用户登录
 * POST /api/auth/login
 * Body: { email, password }
 */
export async function POST(request: NextRequest) {
  // Rate Limit：同一 IP 5分钟最多10次
  const ip = getClientIP(request);
  const rl = await rateLimit(ip, AUTH_LIMIT);
  if (!rl.success) return rateLimitResponse(rl);
  if (!db) return NextResponse.json({ success: false, error: "数据库未配置" }, { status: 503 });
  try {
    const body = await request.json();
    const { email, password } = body;

    // 参数验证
    if (!email || !password) {
      return NextResponse.json(
        { error: '邮箱和密码为必填项' },
        { status: 400 }
      );
    }

    let user = null;

    try {
      // 尝试使用 PostgreSQL 数据库
      const userList = await db
        .select({
          id: users.id,
          email: users.email,
          nickname: users.nickname,
          passwordHash: users.passwordHash,
          role: users.role,
          power: users.power,
          avatar: users.avatar,
        })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      user = userList[0];
    } catch (dbError) {
      console.log('数据库连接失败，使用内存数据库:', dbError);
      // 回退到内存数据库
      user = await memoryDb.users.findByEmail(email);
      console.log('内存数据库查找结果:', user ? `找到用户 ${user.email}` : '未找到用户');
    }

    if (!user) {
      return NextResponse.json(
        { error: '邮箱或密码错误' },
        { status: 401 }
      );
    }

    // 验证密码
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: '邮箱或密码错误' },
        { status: 401 }
      );
    }

    // 生成 JWT Token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // 返回用户信息（不含密码）
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          role: user.role,
          power: user.power,
          avatar: user.avatar,
        },
        token,
      },
      message: '登录成功',
    });

    // 设置 HttpOnly Cookie，浏览器自动随请求发送
    // Secure: false — 因为本服务运行在 HTTP，Secure=true 会导致浏览器不发送 cookie
    // httpOnly 已经是强保护，sameSite: lax 防 CSRF
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('登录错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
