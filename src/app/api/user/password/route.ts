import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { getCurrentUser, verifyPassword, hashPassword } from '@/lib/auth';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    const { oldPassword, newPassword } = await request.json();

    if (!oldPassword || !newPassword) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少旧密码或新密码' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '新密码长度至少6位' }, { status: 400 });
    }

    // 获取用户当前密码
    const user = await db!
      .select({ passwordHash: schema.users.passwordHash })
      .from(schema.users)
      .where(eq(schema.users.id, payload.userId))
      .limit(1);

    if (user.length === 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '用户不存在' }, { status: 404 });
    }

    // 验证旧密码
    const isValid = await verifyPassword(oldPassword, user[0].passwordHash);
    if (!isValid) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '旧密码错误' }, { status: 400 });
    }

    // 更新新密码
    const newHash = await hashPassword(newPassword);
    await db!
      .update(schema.users)
      .set({ passwordHash: newHash })
      .where(eq(schema.users.id, payload.userId));

    return NextResponse.json({ requestId: reqId(), success: true });
  } catch (error) {
    console.error('[User Password PUT] Error:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '修改密码失败' }, { status: 500 });
  }
}
