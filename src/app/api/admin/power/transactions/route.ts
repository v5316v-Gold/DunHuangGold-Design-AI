/**
 * /api/admin/power/transactions
 * 管理员 · 算力流水（分页 / 类型过滤 / 搜索）
 *
 * GET /api/admin/power/transactions?page=&pageSize=&type=&search=
 *   Resp: { success, data: { transactions, pagination: { page, pageSize, total, totalPages } } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { powerTransactions } from '@/db/schema/_tables';
import { eq, desc, and, sql, type SQL } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10) || 10)
  );
  const type = searchParams.get('type') || undefined;
  const search = searchParams.get('search') || undefined;

  const empty = {
    transactions: [] as unknown[],
    pagination: { page, pageSize, total: 0, totalPages: 1 },
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
    const conditions: SQL[] = [];
    if (type) conditions.push(eq(powerTransactions.type, type));
    if (search) {
      conditions.push(
        sql`(${powerTransactions.userEmail} ILIKE ${'%' + search + '%'} OR ${powerTransactions.userNickname} ILIKE ${'%' + search + '%'})`
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow, rows] = await Promise.all([
      dbc
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(powerTransactions)
        .where(whereClause ?? sql`TRUE`),
      dbc
        .select()
        .from(powerTransactions)
        .where(whereClause ?? sql`TRUE`)
        .orderBy(desc(powerTransactions.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = totalRow[0]?.c ?? 0;
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        transactions: rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
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
