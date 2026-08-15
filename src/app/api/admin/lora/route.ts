/**
 * /api/admin/lora
 * 管理员 · LoRA 管理（loras 表，迁移 006）
 *
 * 说明：loras 表未纳入 drizzle schema（src/db/schema 不可改），
 * 这里与 model-registry 一样使用 drizzle sql 模板参数化查询（禁止字符串拼接）。
 *
 * GET    /api/admin/lora                        - 列表（前端读取 data.loras）
 * POST   /api/admin/lora                        - 新建
 * DELETE /api/admin/lora? id= 或 body { id }     - 删除
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { logAudit } from '@/lib/audit-logger';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

type LoraRow = {
  id: string;
  name: string;
  description: string | null;
  trigger_words: string[] | null;
  file_path: string;
  file_hash: string | null;
  file_size: number | null;
  base_model: string | null;
  scope: string[] | null;
  preview_image: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
} & Record<string, unknown>;

function mapRow(r: LoraRow) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    triggerWords: Array.isArray(r.trigger_words) ? r.trigger_words : [],
    filePath: r.file_path,
    fileHash: r.file_hash,
    fileSize: r.file_size,
    baseModel: r.base_model,
    scope: Array.isArray(r.scope) ? r.scope : [],
    previewImage: r.preview_image,
    enabled: !!r.enabled,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ==================== GET ====================

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: true, loras: [], warning: '数据库未配置' });
  }

  try {
    const rows = await db.execute<LoraRow>(sql`
      SELECT * FROM loras ORDER BY created_at DESC LIMIT 500
    `);
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      loras: (rows.rows ?? []).map(mapRow),
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      loras: [],
      warning: `查询失败（loras 表可能不存在，请确认已执行迁移 006_add_loras.sql）: ${(err as Error).message}`,
    });
  }
}

// ==================== POST（新建） ====================

interface CreateInput {
  name?: string;
  filePath?: string;
  description?: string;
  triggerWords?: string[];
  scope?: string[];
  baseModel?: string;
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
  const filePath = (body.filePath || '').trim();
  if (!name || !filePath) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: '缺少必填字段：name / filePath',
    }, { status: 400 });
  }

  const id = `lora_${randomUUID()}`;
  const triggerWords: string[] = Array.isArray(body.triggerWords) ? body.triggerWords : [];
  const scope: string[] = Array.isArray(body.scope) ? body.scope : [];

  try {
    await db.execute(sql`
      INSERT INTO loras (id, name, description, trigger_words, file_path, base_model, scope, uploaded_by)
      VALUES (
        ${id}, ${name}, ${body.description ?? null},
        ${triggerWords}::text[], ${filePath},
        ${body.baseModel ?? null}, ${scope}::text[],
        ${user.userId}
      )
    `);

    await logAudit({
      action: 'lora-create',
      resourceType: 'lora',
      resourceId: id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      details: { name, filePath },
    });

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { id },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `创建失败（loras 表可能不存在）: ${(err as Error).message}`,
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

  let id: string | null = null;
  const { searchParams } = new URL(request.url);
  const queryId = searchParams.get('id');
  if (queryId) {
    id = queryId;
  } else {
    try {
      const body = await request.json();
      id = typeof body?.id === 'string' ? body.id : null;
    } catch {
      // 无 body，仅用 query
    }
  }

  if (!id) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 id' }, { status: 400 });
  }

  try {
    const result = await db.execute(sql`DELETE FROM loras WHERE id = ${id}`);
    const affected = result.rowCount ?? 0;

    if (affected === 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: 'LoRA 不存在' }, { status: 404 });
    }

    await logAudit({
      action: 'lora-delete',
      resourceType: 'lora',
      resourceId: id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
    });

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { deleted: id },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `删除失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
