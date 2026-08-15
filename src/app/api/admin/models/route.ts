/**
 * /api/admin/models
 * 管理员 · 模型中心（models 表：lora / base-model / controlnet）
 *
 * GET    /api/admin/models?page=&pageSize=&type=   - 列表
 * POST   /api/admin/models                          - 登记模型（仅元数据）
 * PATCH  /api/admin/models                          - 更新（启用/停用/字段）
 * DELETE /api/admin/models                          - 删除记录
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { models } from '@/db/schema/_tables';
import { eq, desc, and, sql, type SQL } from 'drizzle-orm';
import { logAudit } from '@/lib/audit-logger';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

const MODEL_TYPES = ['lora', 'base-model', 'controlnet'];

// ==================== GET ====================

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    500,
    Math.max(1, parseInt(searchParams.get('pageSize') || '100', 10) || 100)
  );
  const type = searchParams.get('type') || undefined;

  if (!db) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { items: [], total: 0 },
      warning: '数据库未配置',
    });
  }
  const dbc = db as NonNullable<typeof db>;

  try {
    const conditions: SQL[] = [];
    if (type && MODEL_TYPES.includes(type)) conditions.push(eq(models.modelType, type));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow, rows] = await Promise.all([
      dbc.select({ c: sql<number>`COUNT(*)::int` }).from(models).where(whereClause ?? sql`TRUE`),
      dbc
        .select()
        .from(models)
        .where(whereClause ?? sql`TRUE`)
        .orderBy(desc(models.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        items: rows,
        total: totalRow[0]?.c ?? 0,
      },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { items: [], total: 0 },
      warning: `查询失败（models 表可能不存在）: ${(err as Error).message}`,
    });
  }
}

// ==================== POST（登记） ====================

interface RegisterInput {
  modelType?: string;
  name?: string;
  version?: string;
  filePath?: string;
  originalFilename?: string;
  description?: string;
  triggerWords?: string[];
  boundFeatures?: string[];
  baseModel?: string;
  weight?: string;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  let body: RegisterInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const modelType = body.modelType || 'lora';
  const name = (body.name || '').trim();
  if (!name) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少必填字段：name' }, { status: 400 });
  }
  if (!MODEL_TYPES.includes(modelType)) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `modelType 必须是 ${MODEL_TYPES.join(' / ')}`,
    }, { status: 400 });
  }

  try {
    const dbc = db as NonNullable<typeof db>;
    const [row] = await dbc
      .insert(models)
      .values({
        modelType,
        name,
        version: body.version || '1.0.0',
        filePath: body.filePath ?? null,
        originalFilename: body.originalFilename ?? null,
        description: body.description ?? null,
        triggerWords: body.triggerWords ?? [],
        boundFeatures: body.boundFeatures ?? [],
        baseModel: body.baseModel ?? null,
        weight: body.weight ?? '0.8',
        uploadedBy: user.userId,
      })
      .returning({ id: models.id });

    await logAudit({
      action: 'model-register',
      resourceType: 'model',
      resourceId: row?.id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      details: { modelType, name },
    });

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { id: row?.id },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `登记失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}

// ==================== PATCH（启用/停用/更新） ====================

interface PatchInput {
  id?: string;
  enabled?: boolean;
  name?: string;
  version?: string;
  baseModel?: string;
  weight?: string;
  description?: string;
  filePath?: string;
  triggerWords?: string[];
  boundFeatures?: string[];
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

  if (!body.id) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 id' }, { status: 400 });
  }

  const setFields: Partial<Record<string, unknown>> = {};
  if (body.enabled !== undefined) setFields.enabled = body.enabled;
  if (body.name !== undefined) setFields.name = body.name;
  if (body.version !== undefined) setFields.version = body.version;
  if (body.baseModel !== undefined) setFields.baseModel = body.baseModel;
  if (body.weight !== undefined) setFields.weight = body.weight;
  if (body.description !== undefined) setFields.description = body.description;
  if (body.filePath !== undefined) setFields.filePath = body.filePath;
  if (body.triggerWords !== undefined) setFields.triggerWords = body.triggerWords;
  if (body.boundFeatures !== undefined) setFields.boundFeatures = body.boundFeatures;
  if (Object.keys(setFields).length === 0) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少更新字段' }, { status: 400 });
  }
  setFields.updatedAt = new Date();

  try {
    const dbc = db as NonNullable<typeof db>;
    const [updated] = await dbc
      .update(models)
      .set(setFields)
      .where(eq(models.id, body.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '模型不存在' }, { status: 404 });
    }

    await logAudit({
      action: 'model-update',
      resourceType: 'model',
      resourceId: body.id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      details: setFields,
    });

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { model: updated },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `更新失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}

// ==================== DELETE ====================

interface DeleteInput {
  id?: string;
  deleteFile?: boolean;
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  let body: DeleteInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const id = body.id;
  if (!id) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 id' }, { status: 400 });
  }

  try {
    const dbc = db as NonNullable<typeof db>;
    const [row] = await dbc.select({ id: models.id }).from(models).where(eq(models.id, id)).limit(1);
    if (!row) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '模型不存在' }, { status: 404 });
    }

    await dbc.delete(models).where(eq(models.id, id));

    await logAudit({
      action: 'model-delete',
      resourceType: 'model',
      resourceId: id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      details: { deleteFile: body.deleteFile ?? false },
    });

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        deleted: id,
        note: body.deleteFile
          ? '数据库记录已删除；落盘文件未自动删除（执行机文件需人工确认）'
          : '数据库记录已删除',
      },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `删除失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
