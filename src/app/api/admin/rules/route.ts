/**
 * /api/admin/rules
 * 管理员 · 提示词规则管理（prompt_rules 表）
 *
 * GET    /api/admin/rules                  - 列表（data 为数组：id/category/name/systemPrompt/enabled/sortOrder）
 * POST   /api/admin/rules                  - 新建（body: id/category/name/systemPrompt/enabled）
 * PUT    /api/admin/rules                  - 更新（body: id + 待更新字段，含 enabled 切换）
 * DELETE /api/admin/rules?id=xxx           - 删除
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { promptRules } from '@/db/schema/_tables';
import { eq, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

// ==================== GET ====================

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: true, data: [], warning: '数据库未配置' });
  }
  const dbc = db as NonNullable<typeof db>;

  try {
    const rows = await dbc
      .select()
      .from(promptRules)
      .orderBy(asc(promptRules.sortOrder), asc(promptRules.createdAt));
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: rows,
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: [],
      warning: `查询失败（prompt_rules 表可能不存在）: ${(err as Error).message}`,
    });
  }
}

// ==================== POST（新建） ====================

interface CreateInput {
  id?: string;
  category?: string;
  name?: string;
  systemPrompt?: string;
  enabled?: boolean;
  sortOrder?: number;
  /** 前端会传，但 schema 无此列，忽略 */
  showOnAssistant?: boolean;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  let body: CreateInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const name = (body.name || '').trim();
  const systemPrompt = (body.systemPrompt || '').trim();
  if (!name || !systemPrompt) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: '缺少必填字段：name / systemPrompt',
    }, { status: 400 });
  }

  const id = typeof body.id === 'string' && body.id ? body.id : `rule_${randomUUID()}`;

  try {
    const dbc = db as NonNullable<typeof db>;
    await dbc
      .insert(promptRules)
      .values({
        id,
        category: body.category || 'optimize',
        name,
        systemPrompt,
        enabled: body.enabled ?? true,
        sortOrder: body.sortOrder ?? 0,
      })
      .onConflictDoUpdate({
        target: promptRules.id,
        set: {
          name,
          systemPrompt,
          category: body.category || 'optimize',
          enabled: body.enabled ?? true,
          sortOrder: body.sortOrder ?? 0,
          updatedAt: new Date(),
        },
      });

    return NextResponse.json({ requestId: reqId(), success: true, data: { id } });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `保存失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}

// ==================== PUT（更新） ====================

interface UpdateInput {
  id?: string;
  name?: string;
  category?: string;
  systemPrompt?: string;
  enabled?: boolean;
  sortOrder?: number;
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  let body: UpdateInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 id' }, { status: 400 });
  }

  const setFields: Partial<typeof promptRules.$inferInsert> = {};
  if (body.name !== undefined) setFields.name = body.name;
  if (body.category !== undefined) setFields.category = body.category;
  if (body.systemPrompt !== undefined) setFields.systemPrompt = body.systemPrompt;
  if (body.enabled !== undefined) setFields.enabled = body.enabled;
  if (body.sortOrder !== undefined) setFields.sortOrder = body.sortOrder;
  if (Object.keys(setFields).length === 0) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少更新字段' }, { status: 400 });
  }
  setFields.updatedAt = new Date();

  try {
    const dbc = db as NonNullable<typeof db>;
    const [updated] = await dbc
      .update(promptRules)
      .set(setFields)
      .where(eq(promptRules.id, body.id))
      .returning({ id: promptRules.id });

    if (!updated) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '规则不存在' }, { status: 404 });
    }

    return NextResponse.json({ requestId: reqId(), success: true, data: { id: body.id } });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `更新失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}

// ==================== DELETE ====================

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 id 参数' }, { status: 400 });
  }

  try {
    const dbc = db as NonNullable<typeof db>;
    const result = await dbc.delete(promptRules).where(eq(promptRules.id, id)).returning({ id: promptRules.id });
    if (result.length === 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '规则不存在' }, { status: 404 });
    }
    return NextResponse.json({ requestId: reqId(), success: true, data: { deleted: id } });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `删除失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
