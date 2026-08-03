/**
 * 任务中心 API - 任务列表（管理员）
 *
 * GET /api/admin/tasks?page=1&pageSize=20&status=&feature=
 *   - 分页查询任务列表（按 createdAt desc）
 *   - 支持 status / featureCode 过滤
 *   - 返回 { success, data: { items, total, page, pageSize }, error, meta }
 *
 * 鉴权：requireAdmin（admin / superadmin）+ logAudit(action: 'tasks.list')
 */

import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, sql } from 'drizzle-orm';
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

async function admin(request: NextRequest) {
  const user = await requireAuth(request);
  return user && (user.role === 'admin' || user.role === 'superadmin') ? user : null;
}

/**
 * GET /api/admin/tasks
 * 分页查询任务列表
 */
export async function GET(request: NextRequest) {
  const user = await admin(request);
  if (!user) return forbidden();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10) || 20)
  );
  const status = searchParams.get('status') || '';
  const feature = searchParams.get('feature') || '';

  try {
    // 无数据库（开发 mock 模式）：返回空列表
    if (!db) {
      return NextResponse.json({
        success: true,
        data: { items: [], total: 0, page, pageSize },
        error: null,
        meta: { mode: 'mock' },
      });
    }

    const conditions = [];
    if (status) conditions.push(eq(tasks.status, status));
    if (feature) conditions.push(eq(tasks.featureCode, feature));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // 查询任务列表（不含 input/output，列表页无需大字段）
    const items = await db
      .select({
        id: tasks.id,
        userId: tasks.userId,
        featureCode: tasks.featureCode,
        type: tasks.type,
        status: tasks.status,
        executor: tasks.executor,
        progress: tasks.progress,
        retryCount: tasks.retryCount,
        maxRetries: tasks.maxRetries,
        error: tasks.error,
        powerCost: tasks.powerCost,
        createdAt: tasks.createdAt,
        startedAt: tasks.startedAt,
        completedAt: tasks.completedAt,
        cancelledAt: tasks.cancelledAt,
      })
      .from(tasks)
      .where(where)
      .orderBy(desc(tasks.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // 查询总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(where);
    const total = Number(countResult[0]?.count || 0);

    await logAudit({
      action: 'tasks.list',
      resourceType: 'task',
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      details: { page, pageSize, status, feature },
    });

    return NextResponse.json({
      success: true,
      data: { items, total, page, pageSize },
      error: null,
      meta: {},
    });
  } catch (error) {
    console.error('[admin/tasks] 查询任务列表失败:', error);
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
