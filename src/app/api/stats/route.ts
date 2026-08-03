/**
 * 用户统计 API
 * 获取用户的算力使用统计
 */
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到统一 stats 入口（GET by role）
 * 合并目标: /api/stats (统一用户统计入口)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { powerLogs, users } from '@/db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('stats');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/stats - 获取用户统计信息
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401, headers: { 'X-Deprecated-Source': 'stats' } });
    }

    if (!db) {
      return NextResponse.json({ success: false, error: '数据库未连接' }, { status: 500, headers: { 'X-Deprecated-Source': 'stats' } });
    }

    // 获取用户信息
    const userResult = await db
      .select({
        power: users.power,
        nickname: users.nickname,
      })
      .from(users)
      .where(eq(users.id, user.userId))
      .limit(1);

    if (!userResult || userResult.length === 0) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    const userInfo = userResult[0];

    // 获取今日算力消耗
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayDeduct = await db
      .select({
        total: sql<number>`COALESCE(SUM(${powerLogs.amount}), 0)`,
      })
      .from(powerLogs)
      .where(
        and(
          eq(powerLogs.userId, user.userId),
          eq(powerLogs.type, 'deduct'),
          sql`${powerLogs.createdAt} >= ${today}`
        )
      );

    // 获取本周算力消耗
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekDeduct = await db
      .select({
        total: sql<number>`COALESCE(SUM(${powerLogs.amount}), 0)`,
      })
      .from(powerLogs)
      .where(
        and(
          eq(powerLogs.userId, user.userId),
          eq(powerLogs.type, 'deduct'),
          sql`${powerLogs.createdAt} >= ${weekStart}`
        )
      );

    // 获取本月算力消耗
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthDeduct = await db
      .select({
        total: sql<number>`COALESCE(SUM(${powerLogs.amount}), 0)`,
      })
      .from(powerLogs)
      .where(
        and(
          eq(powerLogs.userId, user.userId),
          eq(powerLogs.type, 'deduct'),
          sql`${powerLogs.createdAt} >= ${monthStart}`
        )
      );

    // 获取最近操作记录
    const recentLogs = await db
      .select()
      .from(powerLogs)
      .where(eq(powerLogs.userId, user.userId))
      .orderBy(desc(powerLogs.createdAt))
      .limit(10);

    // 按类型统计总消耗
    const typeStats = await db
      .select({
        type: powerLogs.type,
        total: sql<number>`COALESCE(SUM(${powerLogs.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(powerLogs)
      .where(eq(powerLogs.userId, user.userId))
      .groupBy(powerLogs.type);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          nickname: userInfo.nickname,
          currentPower: userInfo.power,
        },
        statistics: {
          today: {
            deduct: Number(todayDeduct[0]?.total || 0),
          },
          week: {
            deduct: Number(weekDeduct[0]?.total || 0),
          },
          month: {
            deduct: Number(monthDeduct[0]?.total || 0),
          },
        },
        recentLogs: recentLogs.map(log => ({
          id: log.id,
          type: log.type,
          amount: log.amount,
          balance: log.balance,
          reason: log.reason,
          createdAt: log.createdAt,
        })),
        typeStats,
      },
    }, {
      headers: { 'X-Deprecated-Source': 'stats' },
    });

  } catch (error) {
    logger.error('获取统计信息失败', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
