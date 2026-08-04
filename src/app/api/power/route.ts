import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/validators';

import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { users, powerLogs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}
export const dynamic = 'force-dynamic';

/**
 * 获取用户算力信息
 * GET /api/power
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);

    if (!payload) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    // 开发模式返回模拟数据
    if (!db) {
      return NextResponse.json({
        requestId: reqId(), success: true,
        data: {
          power: 100,
          logs: [],
        },
      });
    }

    // 获取用户算力
    const [user] = await db
      .select({ power: users.power })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '用户不存在' }, { status: 404 });
    }

    // 获取最近算力日志
    const logs = await db
      .select()
      .from(powerLogs)
      .where(eq(powerLogs.userId, payload.userId))
      .orderBy(desc(powerLogs.createdAt))
      .limit(50);

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: {
        power: user.power,
        logs,
      },
    });
  } catch (error) {
    return NextResponse.json({ requestId: reqId(), success: false, error: sanitizeError(error, '操作失败').message }, { status: 500 });
  }
}

/**
 * 扣除算力
 * POST /api/power
 * Body: { action: 'deduct', amount: number, reason: string, relatedId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);

    if (!payload) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { action, amount, reason, relatedId } = body;

    if (!action || !amount) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少参数' }, { status: 400 });
    }

    // 开发模式：直接返回成功
    if (!db) {
      return NextResponse.json({
        requestId: reqId(), success: true,
        data: { power: 100 - amount },
        message: '算力扣除成功（开发模式）',
      });
    }

    // 获取当前算力
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '用户不存在' }, { status: 404 });
    }

    let newPower: number;

    switch (action) {
      case 'deduct':
        if (user.power < amount) {
          return NextResponse.json({ requestId: reqId(), success: false, error: '算力不足' }, { status: 400 });
        }
        newPower = user.power - amount;
        break;

      case 'add':
        newPower = user.power + amount;
        break;

      case 'set':
        newPower = Math.max(0, amount);
        break;

      default:
        return NextResponse.json({ requestId: reqId(), success: false, error: '未知操作' }, { status: 400 });
    }

    // 更新算力
    await db
      .update(users)
      .set({ power: newPower, updatedAt: new Date() })
      .where(eq(users.id, payload.userId));

    // 记录日志
    await db.insert(powerLogs).values({
      userId: payload.userId,
      type: action,
      amount: action === 'deduct' ? -amount : amount,
      balance: newPower,
      reason: reason || `${action}算力`,
      relatedId,
    });

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: { power: newPower },
      message: '操作成功',
    });
  } catch (error) {
    return NextResponse.json({ requestId: reqId(), success: false, error: sanitizeError(error, '操作失败').message }, { status: 500 });
  }
}
