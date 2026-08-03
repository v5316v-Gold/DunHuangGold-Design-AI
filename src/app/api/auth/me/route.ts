import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db, users } from '@/storage/database/db';
import { eq } from 'drizzle-orm';

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
export async function GET(request: NextRequest) {
  if (!db) return NextResponse.json({ success: false, error: "数据库未配置" }, { status: 503 });
  try {
    const payload = await getCurrentUser(request);

    if (!payload) {
      return NextResponse.json(
        { error: '未登录' },
        { status: 401 }
      );
    }

    // 使用 Drizzle 获取用户信息
    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        nickname: users.nickname,
        role: users.role,
        power: users.power,
        avatar: users.avatar,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    const user = userList[0];

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return NextResponse.json(
      { error: '服务器错误，请稍后重试' },
      { status: 500 }
    );
  }
}
