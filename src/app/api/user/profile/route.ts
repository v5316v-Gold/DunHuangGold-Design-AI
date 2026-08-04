import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    const user = await db!
      .select({
        id: schema.users.id,
        email: schema.users.email,
        nickname: schema.users.nickname,
        avatar: schema.users.avatar,
        role: schema.users.role,
        power: schema.users.power,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.id, payload.userId))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '用户不存在' }, { status: 404 });
    }

    return NextResponse.json({ requestId: reqId(), success: true, data: user[0] });
  } catch (error) {
    console.error('[User Profile GET] Error:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '获取用户信息失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { nickname, avatar } = body;

    // 更新用户信息
    const updates: Record<string, any> = {};
    if (nickname !== undefined) updates.nickname = nickname;
    if (avatar !== undefined) updates.avatar = avatar;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '没有需要更新的字段' }, { status: 400 });
    }

    await db!
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, payload.userId));

    return NextResponse.json({ requestId: reqId(), success: true });
  } catch (error) {
    console.error('[User Profile PUT] Error:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '更新用户信息失败' }, { status: 500 });
  }
}
