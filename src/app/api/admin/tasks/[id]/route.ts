/**
 * 任务中心 API - 任务详情（管理员）
 *
 * GET /api/admin/tasks/[id]
 *   - 返回任务完整详情（含 input / output / error）
 *
 * 鉴权：requireAdmin（admin / superadmin）+ logAudit(action: 'tasks.detail')
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
 * GET /api/admin/tasks/[id]
 * 任务详情（含 input/output/error）
 */
export async function GET(
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
        data: null,
        error: null,
        meta: { mode: 'mock' },
      });
    }

    const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!row) return notFound();

    await logAudit({
      action: 'tasks.detail',
      resourceType: 'task',
      resourceId: id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
    });

    return NextResponse.json({
      success: true,
      data: row,
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/tasks] 查询任务详情失败:', error);
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
