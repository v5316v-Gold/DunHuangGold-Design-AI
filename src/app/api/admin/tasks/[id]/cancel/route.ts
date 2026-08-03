/**
 * 任务中心 API - 取消任务（管理员）
 *
 * POST /api/admin/tasks/[id]/cancel
 *   - status 改为 'cancelled'，cancelledAt = NOW()
 *
 * 鉴权：requireAdmin（admin / superadmin）+ logAudit(action: 'tasks.cancel')
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { tasks } from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit-logger';

export const dynamic = 'force-dynamic';

function forbidden() {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: { code: 'FORBIDDEN', message: '需要管理员权限' },
      meta: {},
    },
    { status: 403 }
  );
}

function notFound() {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: '任务不存在' },
      meta: {},
    },
    { status: 404 }
  );
}

async function admin(request: NextRequest) {
  const user = await requireAuth(request);
  return user && (user.role === 'admin' || user.role === 'superadmin') ? user : null;
}

/**
 * POST /api/admin/tasks/[id]/cancel
 * 取消任务：status -> cancelled，cancelledAt = NOW()
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await admin(request);
  if (!user) return forbidden();

  const { id } = await params;

  try {
    if (!db) {
      return NextResponse.json({
        success: true,
        data: { id, status: 'cancelled', cancelledAt: new Date().toISOString() },
        error: null,
        meta: { mode: 'mock' },
      });
    }

    const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!row) return notFound();

    const [updated] = await db
      .update(tasks)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    await logAudit({
      action: 'tasks.cancel',
      resourceType: 'task',
      resourceId: id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      details: {
        fromStatus: row.status,
        cancelledAt: updated.cancelledAt,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/tasks] 取消任务失败:', error);
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' },
        meta: {},
      },
      { status: 500 }
    );
  }
}
