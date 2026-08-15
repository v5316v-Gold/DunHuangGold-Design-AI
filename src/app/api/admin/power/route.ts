/**
 * /api/admin/power
 * 管理员 · 算力管理汇总
 *
 * GET /api/admin/power
 *   Resp: { success, data: { packages, consumption, totalBalance, todayConsumed, todayRecharge, todayConsumeCount, todayRechargeCount } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { users, powerTransactions } from '@/db/schema/_tables';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  const empty = {
    packages: [] as unknown[],
    consumption: [] as unknown[],
    totalBalance: 0,
    todayConsumed: 0,
    todayRecharge: 0,
    todayConsumeCount: 0,
    todayRechargeCount: 0,
  };

  if (!db) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: empty,
      warning: '数据库未配置',
    });
  }
  const dbc = db as NonNullable<typeof db>;

  try {
    const today = todayStart();
    const [balanceRow, consumedRow, rechargedRow, consumeCountRow, rechargeCountRow] =
      await Promise.all([
        dbc.select({ s: sql<number>`COALESCE(SUM(${users.power}), 0)::int` }).from(users),
        dbc
          .select({ s: sql<number>`COALESCE(SUM(ABS(${powerTransactions.amount})), 0)::int` })
          .from(powerTransactions)
          .where(
            sql`${powerTransactions.type} IN ('consume', 'deduct') AND ${powerTransactions.createdAt} >= ${today}`
          ),
        dbc
          .select({ s: sql<number>`COALESCE(SUM(${powerTransactions.amount}), 0)::int` })
          .from(powerTransactions)
          .where(
            sql`${powerTransactions.type} IN ('recharge', 'bonus') AND ${powerTransactions.createdAt} >= ${today}`
          ),
        dbc
          .select({ c: sql<number>`COUNT(*)::int` })
          .from(powerTransactions)
          .where(sql`${powerTransactions.type} IN ('consume', 'deduct') AND ${powerTransactions.createdAt} >= ${today}`),
        dbc
          .select({ c: sql<number>`COUNT(*)::int` })
          .from(powerTransactions)
          .where(sql`${powerTransactions.type} IN ('recharge', 'bonus') AND ${powerTransactions.createdAt} >= ${today}`),
      ]);

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        packages: [],
        consumption: [],
        totalBalance: balanceRow[0]?.s ?? 0,
        todayConsumed: consumedRow[0]?.s ?? 0,
        todayRecharge: rechargedRow[0]?.s ?? 0,
        todayConsumeCount: consumeCountRow[0]?.c ?? 0,
        todayRechargeCount: rechargeCountRow[0]?.c ?? 0,
      },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: empty,
      warning: `查询失败（power_transactions 表可能不存在）: ${(err as Error).message}`,
    });
  }
}
