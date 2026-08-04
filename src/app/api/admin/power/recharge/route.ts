import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { powerTransactions } from '@/db/schema/power-transactions';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const dynamic = 'force-dynamic';

/**
 * 算力充值/扣除
 * POST /api/admin/power/recharge
 * Body: { userId, amount, type: 'recharge'|'deduct', reason }
 */
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到 /api/admin/power POST
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    
    // 权限检查
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, amount, type = 'recharge', reason } = body;

    // 参数验证
    if (!userId) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '用户ID不能为空' }, { status: 400 });
    }
    
    if (!amount || typeof amount !== 'number' || amount === 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '金额不能为空且不能为0' }, { status: 400 });
    }

    // 查询用户当前余额
    if (!db) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未连接' }, { status: 500 });
    }
    
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '用户不存在' }, { status: 404 });
    }

    const user = userResult[0];
    const currentBalance = user.power || 0;
    
    // 计算新余额
    const isDeduct = type === 'deduct';
    const actualAmount = isDeduct ? -Math.abs(amount) : Math.abs(amount);
    const newBalance = currentBalance + actualAmount;
    
    // 扣除时不能为负数
    if (newBalance < 0) {
      return NextResponse.json({ 
        requestId: reqId(), success: false, 
        error: `余额不足。当前余额: ${currentBalance}，无法扣除 ${Math.abs(amount)}` 
      }, { status: 400 });
    }

    // 更新用户余额
    await db
      .update(users)
      .set({ 
        power: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 记录算力流水
    await db.insert(powerTransactions).values({
      userId,
      userEmail: user.email,
      userNickname: user.nickname,
      type: isDeduct ? 'deduct' : 'recharge',
      amount: actualAmount,
      balanceBefore: currentBalance,
      balanceAfter: newBalance,
      reason: reason || (isDeduct ? '管理员扣除' : '管理员充值'),
      operatorId: payload.userId,
      operatorEmail: payload.email,
      relatedId: `admin_${payload.userId}_${Date.now()}`,
    });

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: {
        userId,
        type: isDeduct ? 'deduct' : 'recharge',
        amount: actualAmount,
        previousBalance: currentBalance,
        newBalance,
        reason: reason || (isDeduct ? '管理员扣除' : '管理员充值'),
      },
    });
  } catch (error) {
    console.error('[Power Recharge] 充值失败:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '服务器错误' }, { status: 500 });
  }
}
