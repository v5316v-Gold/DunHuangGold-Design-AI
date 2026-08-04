/**
 * 管理后台统计 API
 */
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到统一 admin stats 入口
 * 合并目标: /api/admin/stats (统一管理统计)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { users, works, powerLogs } from '@/db/schema';
import { eq, sql, gte } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
    }

    if (!db) {
      return NextResponse.json({
        requestId: reqId(), success: true,
        data: {
          totalUsers: 12580,
          activeUsers: 3420,
          todayGenerated: 8756,
          totalGenerated: 125680,
          totalPower: 1568000,
          usedPower: 890000,
          pendingWorks: 3,
          newUsersToday: 156,
        },
        mock: true,
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // 总用户数
    const totalUsersResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    // 今日新用户
    const newUsersTodayResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(gte(users.createdAt, today));

    // 活跃用户（7天内有操作）
    const activeUsersResult = await db
      .select({ count: sql<number>`count(DISTINCT ${powerLogs.userId})` })
      .from(powerLogs)
      .where(gte(powerLogs.createdAt, weekAgo));

    // 今日生成
    const todayWorksResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(works)
      .where(gte(works.createdAt, today));

    // 累计生成
    const totalWorksResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(works);

    // 总算力
    const totalPowerResult = await db
      .select({ sum: sql<number>`COALESCE(SUM(${users.power}), 0)` })
      .from(users);

    // 已消耗算力
    const usedPowerResult = await db
      .select({ sum: sql<number>`COALESCE(SUM(ABS(${powerLogs.amount})), 0)` })
      .from(powerLogs)
      .where(eq(powerLogs.type, 'deduct'));

    const data = {
      totalUsers: Number(totalUsersResult[0]?.count || 0),
      activeUsers: Number(activeUsersResult[0]?.count || 0),
      newUsersToday: Number(newUsersTodayResult[0]?.count || 0),
      todayGenerated: Number(todayWorksResult[0]?.count || 0),
      totalGenerated: Number(totalWorksResult[0]?.count || 0),
      totalPower: Number(totalPowerResult[0]?.sum || 0),
      usedPower: Number(usedPowerResult[0]?.sum || 0),
      pendingWorks: 0,
    };

    return NextResponse.json({ requestId: reqId(), success: true, data }, { headers: { 'X-Deprecated-Source': 'admin/stats' } });

  } catch (error) {
    console.error('[admin/stats]', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '获取失败' }, { status: 500 });
  }
}
