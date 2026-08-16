import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { adminPasswordHistory } from '@/db/schema/_tables';
import { eq } from 'drizzle-orm';
import { getCurrentUser, verifyPassword, hashPassword } from '@/lib/auth';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

const WEAK = new Set(['admin', 'admin123', 'admin@123', 'changeme', '123456', 'password', 'qwerty']);

/** W1·Admin 首次登录:允许无 oldPassword(已知 userId)直接重置 */
function isAdminReset(payload: { role: string; userId: string }, body: { oldPassword?: string }) {
  return payload.role === 'admin' && !body.oldPassword;
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { oldPassword, newPassword } = body;

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '新密码长度至少 8 位' }, { status: 400 });
    }
    if (WEAK.has(String(newPassword).toLowerCase())) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '新密码过于简单,请更换' }, { status: 400 });
    }

    const skipOld = isAdminReset(payload, body);

    if (!skipOld) {
      if (!oldPassword) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '请填写旧密码' }, { status: 400 });
      }
      const user = await db!
        .select({ passwordHash: schema.users.passwordHash })
        .from(schema.users)
        .where(eq(schema.users.id, payload.userId))
        .limit(1);
      if (user.length === 0) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '用户不存在' }, { status: 404 });
      }
      const isValid = await verifyPassword(oldPassword, user[0].passwordHash);
      if (!isValid) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '旧密码错误' }, { status: 400 });
      }
    }

    // 更新新密码 + 记录历史
    const newHash = await hashPassword(newPassword);
    await db!
      .update(schema.users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(schema.users.id, payload.userId));

    // W1·admin 强制改完解锁
    if (payload.role === 'admin' && db) {
      await db
        .insert(adminPasswordHistory)
        .values({ userId: payload.userId, lastChange: new Date(), mustChange: false })
        .onConflictDoUpdate({
          target: adminPasswordHistory.userId,
          set: { lastChange: new Date(), mustChange: false, updatedAt: new Date() },
        });
    }

    return NextResponse.json({ requestId: reqId(), success: true });
  } catch (error) {
    console.error('[User Password PUT] Error:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '修改密码失败' }, { status: 500 });
  }
}
