/**
 * /api/admin/works
 * 管理员 · 作品审核
 *
 * GET   /api/admin/works?status=&page=&pageSize=   - 作品列表
 *       前端期望 data 直接是数组，且字段含 image_url / user_id（snake_case 兼容旧约定）
 * POST  /api/admin/works                          - 审核：{ id, action: 'approve' | 'reject' }
 * PATCH /api/admin/works                          - 更新：{ id, status?, isPublic? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { works } from '@/db/schema/_tables';
import { eq, desc, and, sql, type SQL } from 'drizzle-orm';
import { logAudit } from '@/lib/audit-logger';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

/**
 * 作品行 → 前端期望的展示字段
 * 注意：作品审核 tab 使用 work.image_url / work.user_id（snake_case），
 * 这里同时输出 snake_case 与 camelCase 两套，保证兼容。
 */
function mapWork(row: Record<string, unknown>) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    featureCode: row.featureCode,
    // snake_case（前端作品审核 tab 依赖）
    image_url: (row.outputImageUrl as string | null) ?? (row.inputImageUrl as string | null) ?? null,
    user_id: row.userId,
    status: row.status,
    is_public: row.isPublic,
    created_at: row.createdAt,
    // camelCase 补充
    userId: row.userId,
    outputImageUrl: row.outputImageUrl ?? null,
    inputImageUrl: row.inputImageUrl ?? null,
    isPublic: row.isPublic,
    powerCost: row.powerCost,
    createdAt: row.createdAt,
  };
}

// ==================== GET ====================

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get('pageSize') || '50', 10) || 50)
  );
  // 默认返回全部作品（便于审核历史数据）；也可用 ?status=pending 只看待审核
  const status = searchParams.get('status') || undefined;

  if (!db) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: [],
      warning: '数据库未配置',
    });
  }
  const dbc = db as NonNullable<typeof db>;

  try {
    const conditions: SQL[] = [];
    if (status) conditions.push(eq(works.status, status));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await dbc
      .select()
      .from(works)
      .where(whereClause ?? sql`TRUE`)
      .orderBy(desc(works.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: rows.map(mapWork),
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: [],
      warning: `查询失败（works 表可能不存在）: ${(err as Error).message}`,
    });
  }
}

// ==================== POST（审核） ====================

interface ReviewInput {
  id?: string;
  action?: 'approve' | 'reject';
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  let body: ReviewInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const { id, action } = body;
  if (!id || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: '缺少 id 或 action（approve / reject）',
    }, { status: 400 });
  }

  try {
    const dbc = db as NonNullable<typeof db>;
    const status = action === 'approve' ? 'approved' : 'rejected';
    const isPublic = action === 'approve';

    const [updated] = await dbc
      .update(works)
      .set({ status, isPublic })
      .where(eq(works.id, id))
      .returning({ id: works.id, status: works.status, isPublic: works.isPublic });

    if (!updated) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '作品不存在' }, { status: 404 });
    }

    await logAudit({
      action: `work-${action}`,
      resourceType: 'work',
      resourceId: id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      details: { status, isPublic },
    });

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { id, status, isPublic },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `审核失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}

// ==================== PATCH（审核/公开状态） ====================

interface PatchInput {
  id?: string;
  status?: string;
  isPublic?: boolean;
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  let body: PatchInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 id' }, { status: 400 });
  }

  const setFields: Partial<Record<string, unknown>> = {};
  if (body.status !== undefined) setFields.status = body.status;
  if (body.isPublic !== undefined) setFields.isPublic = body.isPublic;
  if (Object.keys(setFields).length === 0) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少更新字段：status / isPublic' }, { status: 400 });
  }

  try {
    const dbc = db as NonNullable<typeof db>;
    const [updated] = await dbc
      .update(works)
      .set(setFields)
      .where(eq(works.id, id))
      .returning({ id: works.id, status: works.status, isPublic: works.isPublic });

    if (!updated) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '作品不存在' }, { status: 404 });
    }

    await logAudit({
      action: 'work-update',
      resourceType: 'work',
      resourceId: id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      details: setFields,
    });

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: updated,
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `更新失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
