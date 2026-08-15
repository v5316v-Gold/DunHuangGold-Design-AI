/**
 * /api/admin/tasks/[id]/cancel
 * 管理员 · 取消任务（仅排队/执行中可取消）
 *
 * POST /api/admin/tasks/[id]/cancel
 *   Resp: { success, data: { id, status: 'cancelled' } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { tasks } from '@/db/schema/_tables';
import { eq } from 'drizzle-orm';
import { logAudit } from '@/lib/audit-logger';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

const CANCELLABLE = ['pending', 'running', 'processing'];

export async function POST(
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
    const [row] = await dbc.select({ status: tasks.status }).from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!row) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '任务不存在' }, { status: 404 });
    }
    if (!CANCELLABLE.includes(row.status)) {
      return NextResponse.json({
        requestId: reqId(),
        success: false,
        error: `任务已结束（${row.status}），无法取消`,
      }, { status: 409 });
    }

    const [updated] = await dbc
      .update(tasks)
      .set({ status: 'cancelled', cancelledAt: new Date(), error: '已由管理员取消' })
      .where(eq(tasks.id, id))
      .returning({ id: tasks.id, status: tasks.status });

    await logAudit({
      action: 'task-cancel',
      resourceType: 'task',
      resourceId: id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
    });

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { id, status: updated?.status ?? 'cancelled' },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `取消失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
