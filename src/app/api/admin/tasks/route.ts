/**
 * /api/admin/tasks
 * 管理员 · 任务中心列表
 *
 * GET /api/admin/tasks?page=&pageSize=&status=&feature=
 *   Resp: { success, data: { items, total, page, pageSize } }
 *
 * 状态兼容：前端用 running/succeeded，历史数据可能是 processing/completed，
 * 这里做映射：running → (running, processing)；succeeded → (succeeded, completed)。
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { tasks } from '@/db/schema/_tables';
import { eq, desc, and, inArray, sql, type SQL } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

/** 前端状态 → 数据库可能的状态集合 */
function statusSet(status: string | null): string[] | null {
  if (!status) return null;
  switch (status) {
    case 'running':
      return ['running', 'processing'];
    case 'succeeded':
      return ['succeeded', 'completed'];
    default:
      return [status];
  }
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
    Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20)
  );
  const status = searchParams.get('status') || null;
  const feature = searchParams.get('feature') || undefined;

  if (!db) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { items: [], total: 0, page, pageSize },
      warning: '数据库未配置',
    });
  }
  const dbc = db as NonNullable<typeof db>;

  try {
    const conditions: SQL[] = [];
    const statuses = statusSet(status);
    if (statuses) conditions.push(inArray(tasks.status, statuses));
    if (feature) conditions.push(eq(tasks.featureCode, feature));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow, rows] = await Promise.all([
      dbc
        .select({ c: sql<number>`COUNT(*)::int` })
        .from(tasks)
        .where(whereClause ?? sql`TRUE`),
      dbc
        .select()
        .from(tasks)
        .where(whereClause ?? sql`TRUE`)
        .orderBy(desc(tasks.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        items: rows,
        total: totalRow[0]?.c ?? 0,
        page,
        pageSize,
      },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { items: [], total: 0, page, pageSize },
      warning: `查询失败（tasks 表可能不存在）: ${(err as Error).message}`,
    });
  }
}
