import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { users, powerLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';

// 导入共享的模拟数据模块
import { rechargeMockUserBalance } from '../../mock-data';
export const dynamic = 'force-dynamic';

/**
 * 用户充值
 * POST /api/admin/users/[id]/recharge
 */
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到 /api/admin/users POST action=recharge
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await getCurrentUser(request);
    const { id: userId } = await params;
    const body = await request.json();
    const { amount, reason } = body;

    // 参数验证
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ success: false, error: '充值金额必须大于0' }, { status: 400 });
    }

    // 开发模式返回模拟结果（跳过权限检查）
    if (!db) {
      const { previousBalance, newBalance } = rechargeMockUserBalance(userId, amount);
      
      console.log(`[Mock] 充值成功: 用户 ${userId}, 原余额 ${previousBalance}, 充值 ${amount}, 新余额 ${newBalance}`);
      
      return NextResponse.json({
        success: true,
        data: {
          userId,
          amount,
          previousBalance,
          newBalance,
          reason: reason || '管理员充值',
        },
        mode: 'mock',
      });
    }

    // 生产环境权限检查
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    // 查询用户当前余额
    const userResult = await db
      .select({ power: users.power })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    const currentBalance = userResult[0].power;
    const newBalance = currentBalance + amount;

    // 更新用户余额
    await db
      .update(users)
      .set({ 
        power: newBalance,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // 记录算力日志
    await db.insert(powerLogs).values({
      userId,
      type: 'add',
      amount,
      balance: newBalance,
      reason: reason || '管理员充值',
      relatedId: `admin_${payload.userId}_${Date.now()}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        userId,
        amount,
        previousBalance: currentBalance,
        newBalance,
        reason: reason || '管理员充值',
      },
    });
  } catch (error) {
    console.error('充值失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
