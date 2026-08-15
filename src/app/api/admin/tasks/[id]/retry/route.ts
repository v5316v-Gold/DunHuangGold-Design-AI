/**
 * /api/admin/tasks/[id]/retry
 * 管理员 · 重试任务（失败/已取消 → 重新入队）
 *
 * POST /api/admin/tasks/[id]/retry
 *   Resp: { success, data: { id, status: 'pending' } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { tasks } from '@/db/schema/_tables';
import { eq, sql } from 'drizzle-orm';
import { logAudit } from '@/lib/audit-logger';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

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
    const [updated] = await dbc
      .update(tasks)
      .set({
        status: 'pending',
        error: null,
        progress: 0,
        retryCount: sql`${tasks.retryCount} + 1`,
        cancelledAt: null,
        completedAt: null,
        startedAt: null,
      })
      .where(eq(tasks.id, id))
      .returning({ id: tasks.id, status: tasks.status });

    if (!updated) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '任务不存在' }, { status: 404 });
    }

    await logAudit({
      action: 'task-retry',
      resourceType: 'task',
      resourceId: id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
    });

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { id, status: 'pending' },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `重试失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
