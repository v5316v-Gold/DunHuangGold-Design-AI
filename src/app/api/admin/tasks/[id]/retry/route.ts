/**
 * 任务中心 API - 重试任务（管理员）
 *
 * POST /api/admin/tasks/[id]/retry
 *   - status 改为 'pending'（重新入队）
 *   - retryCount + 1，清空 error / progress / 时间戳
 *
 * 鉴权：requireAdmin（admin / superadmin）+ logAudit(action: 'tasks.retry')
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { tasks } from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit-logger';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

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
 * POST /api/admin/tasks/[id]/retry
 * 重试任务：status -> pending，retryCount+1，清 error
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
        requestId: reqId(), success: true,
        data: { id, status: 'pending', retryCount: 1 },
        error: null,
        meta: { mode: 'mock' },
      });
    }

    const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!row) return notFound();

    const [updated] = await db
      .update(tasks)
      .set({
        status: 'pending',
        retryCount: (row.retryCount ?? 0) + 1,
        error: null,
        progress: 0,
        startedAt: null,
        completedAt: null,
        cancelledAt: null,
      })
      .where(eq(tasks.id, id))
      .returning();

    await logAudit({
      action: 'tasks.retry',
      resourceType: 'task',
      resourceId: id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      details: {
        fromStatus: row.status,
        retryCount: updated.retryCount,
        maxRetries: updated.maxRetries,
      },
    });

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: updated,
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/tasks] 重试任务失败:', error);
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
