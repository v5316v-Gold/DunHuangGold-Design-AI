import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db, users } from '@/storage/database/db';
import { memoryDb } from '@/storage/database/memory-db';
import { eq } from 'drizzle-orm';

/**
 * 获取当前用户信息
 * GET /api/auth/me
 *
 * 返回统一结构：{ success, data: { id, email, nickname, role, power, avatar, createdAt } | null }
 */
export async function GET(request: NextRequest) {
  const payload = await getCurrentUser(request);
  if (!payload) {
    return NextResponse.json({ success: false, data: null, error: '未登录' }, { status: 401 });
  }

  // 优先 PostgreSQL，失败时回退 memoryDb（与 login 路由一致）
  try {
    if (db) {
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
      if (userList[0]) {
        return NextResponse.json({ success: true, data: userList[0], error: null });
      }
    }
  } catch (err) {
    console.warn('[auth/me] PostgreSQL 失败,回退 memoryDb:', (err as Error).message);
  }

  // memoryDb 兜底
  const memUser = await memoryDb.users.findById(payload.userId);
  if (!memUser) {
    return NextResponse.json({ success: false, data: null, error: '用户不存在' }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    data: {
      id: memUser.id,
      email: memUser.email,
      nickname: memUser.nickname,
      role: memUser.role,
      power: memUser.power,
      avatar: memUser.avatar,
      createdAt: memUser.createdAt,
    },
    error: null,
  });
}
