/**
 * /api/admin/tasks/[id]
 * 管理员 · 任务详情
 *
 * GET /api/admin/tasks/[id]
 *   Resp: { success, data: { id, userId, featureCode, type, status, executor, progress,
 *           retryCount, maxRetries, error, powerCost, input, output,
 *           createdAt, startedAt, completedAt, cancelledAt } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { tasks } from '@/db/schema/_tables';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  const { id } = await params;
  try {
    const dbc = db as NonNullable<typeof db>;
    const [row] = await dbc.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!row) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '任务不存在' }, { status: 404 });
    }
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: row,
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `查询失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
