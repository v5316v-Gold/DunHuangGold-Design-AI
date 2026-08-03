/**
 * 管理后台算力统计 API
 */
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到 /api/admin/power（同一文件内）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { users, powerLogs } from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 充值套餐配置
const RECHARGE_PACKAGES = [
  { power: 100, price: 9.9, bonus: 0, desc: '体验尝鲜' },
  { power: 500, price: 39.9, bonus: 20, desc: '基础创作' },
  { power: 1000, price: 69.9, bonus: 50, desc: '进阶创作' },
  { power: 5000, price: 299, bonus: 300, desc: '专业用户' },
  { power: 10000, price: 549, bonus: 800, desc: '资深创作者' },
];

// 功能消耗配置（用于统计展示）
type FeatureKey = 'text2img' | 'relief' | 'image3d' | 'refine' | 'blend' | 'sketch' | 'text2video' | 'img2video';
const FEATURE_CONSUMPTION: Record<FeatureKey, { name: string; cost: number }> = {
  'text2img': { name: '文案生图', cost: 5 },
  'relief': { name: '浮雕设计', cost: 8 },
  'image3d': { name: '3D建模', cost: 15 },
  'refine': { name: '产品精修', cost: 5 },
  'blend': { name: '多图融合', cost: 6 },
  'sketch': { name: '线稿写实', cost: 4 },
  'text2video': { name: '文生视频', cost: 20 },
  'img2video': { name: '图生视频', cost: 15 },
};

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    if (!db) {
      return NextResponse.json({
        success: true,
        data: {
          packages: RECHARGE_PACKAGES,
          consumption: Object.entries(FEATURE_CONSUMPTION).map(([key, val]) => ({
            type: key,
            name: val.name,
            count: Math.floor(Math.random() * 1000) + 100,
          })),
          recentLogs: [],
        },
        mock: true,
      });
    }

    // 获取总算力和用户数
    const totalPowerResult = await db
      .select({ sum: sql<number>`COALESCE(SUM(${users.power}), 0)` })
      .from(users);

    const userCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);

    // 获取今日消耗
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayConsumeResult = await db
      .select({ sum: sql<number>`COALESCE(SUM(ABS(${powerLogs.amount})), 0)` })
      .from(powerLogs)
      .where(eq(powerLogs.type, 'deduct'));

    // 按类型统计消耗
    const consumptionByType = await db
      .select({
        type: powerLogs.reason,
        count: sql<number>`count(*)`,
        total: sql<number>`COALESCE(SUM(ABS(${powerLogs.amount})), 0)`,
      })
      .from(powerLogs)
      .where(eq(powerLogs.type, 'deduct'))
      .groupBy(powerLogs.reason)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // 最近充值记录
    const recentRecharge = await db
      .select()
      .from(powerLogs)
      .where(eq(powerLogs.type, 'recharge'))
      .orderBy(desc(powerLogs.createdAt))
      .limit(10);

    const data = {
      packages: RECHARGE_PACKAGES,
      statistics: {
        totalPower: Number(totalPowerResult[0]?.sum || 0),
        userCount: Number(userCountResult[0]?.count || 0),
        todayConsume: Number(todayConsumeResult[0]?.sum || 0),
      },
      consumption: consumptionByType.map(item => ({
        type: item.type || 'unknown',
        name: FEATURE_CONSUMPTION[item.type as FeatureKey]?.name || item.type || '未知',
        count: Number(item.count),
        total: Number(item.total),
      })),
      recentLogs: recentRecharge.map(log => ({
        id: log.id,
        userId: log.userId,
        type: log.type,
        amount: log.amount,
        balance: log.balance,
        reason: log.reason,
        createdAt: log.createdAt,
      })),
    };

    return NextResponse.json({ success: true, data });

  } catch (error) {
    console.error('[admin/power]', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
