/**
 * Phase 9.23 · Model Registry 单条记录 API
 *
 * GET    /api/admin/model-registry/[id]   - 详情（含 referencedBy 反向引用）
 * PATCH  /api/admin/model-registry/[id]   - 更新状态（disable/enable）或元数据
 * DELETE /api/admin/model-registry/[id]   - Registry Delete（被 Active 引用时禁止）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { db } from '@/storage/database/db';
import { randomUUID } from 'crypto';

function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RegistryRow = {
  id: string;
  name: string;
  type: string;
  version: string | null;
  base_model: string | null;
  filename: string | null;
  relative_path: string | null;
  file_size: number | null;
  sha256: string | null;
  status: string;
  comfyui_category: string | null;
  referenced_by: unknown;
  metadata: unknown;
  disabled_at: string | null;
  disabled_by: string | null;
  created_at: string;
  updated_at: string;
} & Record<string, unknown>;

function mapRow(r: RegistryRow) {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    version: r.version,
    baseModel: r.base_model,
    filename: r.filename,
    relativePath: r.relative_path,
    fileSize: r.file_size,
    sha256: r.sha256,
    status: r.status,
    comfyuiCategory: r.comfyui_category,
    referencedBy: r.referenced_by ?? [],
    metadata: r.metadata ?? {},
    disabledAt: r.disabled_at,
    disabledBy: r.disabled_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletable: !(Array.isArray(r.referenced_by) && (r.referenced_by as Array<{ active?: boolean }>).some((x) => x.active)),
  };
}

// ==================== GET ====================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });

  const { id } = await params;
  try {
    const rows = await db.execute<RegistryRow>(sql`SELECT * FROM model_registry WHERE id = ${id} LIMIT 1`);
    if (!rows.rows?.[0]) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '模型不存在' }, { status: 404 });
    }
    return NextResponse.json({
      requestId: reqId(), success: true,
      data: { model: mapRow(rows.rows[0]) },
    });
  } catch (e) {
    return NextResponse.json({
      requestId: reqId(), success: false, error: `查询失败：${(e as Error).message}`,
    }, { status: 500 });
  }
}

// ==================== PATCH ====================

interface PatchInput {
  /** 操作类型：disable / enable / update */
  action?: 'disable' | 'enable' | 'update';
  /** 更新元数据 */
  metadata?: Record<string, unknown>;
  /** 更新状态（仅 disabled/available/incompatible） */
  status?: 'available' | 'disabled' | 'incompatible' | 'missing';
  /** 更新 SHA256 */
  sha256?: string;
  /** 更新 base_model 信息 */
  baseModel?: string;
  version?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });

  const { id } = await params;
  let body: PatchInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  try {
    if (body.action === 'disable') {
      await db.execute(sql`
        UPDATE model_registry
        SET status = 'disabled', disabled_at = NOW(), disabled_by = ${user.userId}, updated_at = NOW()
        WHERE id = ${id}
      `);
    } else if (body.action === 'enable') {
      await db.execute(sql`
        UPDATE model_registry
        SET status = 'available', disabled_at = NULL, disabled_by = NULL, updated_at = NOW()
        WHERE id = ${id}
      `);
    } else if (body.action === 'update' || body.status || body.sha256 || body.baseModel || body.version || body.metadata) {
      // 通用字段更新
      if (body.status) {
        await db.execute(sql`UPDATE model_registry SET status = ${body.status}, updated_at = NOW() WHERE id = ${id}`);
      }
      if (body.sha256) {
        await db.execute(sql`UPDATE model_registry SET sha256 = ${body.sha256}, updated_at = NOW() WHERE id = ${id}`);
      }
      if (body.baseModel) {
        await db.execute(sql`UPDATE model_registry SET base_model = ${body.baseModel}, updated_at = NOW() WHERE id = ${id}`);
      }
      if (body.version) {
        await db.execute(sql`UPDATE model_registry SET version = ${body.version}, updated_at = NOW() WHERE id = ${id}`);
      }
      if (body.metadata) {
        await db.execute(sql`UPDATE model_registry SET metadata = ${JSON.stringify(body.metadata)}::jsonb, updated_at = NOW() WHERE id = ${id}`);
      }
    } else {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 action 或更新字段' }, { status: 400 });
    }

    const rows = await db.execute<RegistryRow>(sql`SELECT * FROM model_registry WHERE id = ${id} LIMIT 1`);
    return NextResponse.json({
      requestId: reqId(), success: true,
      data: { model: mapRow(rows.rows?.[0]) },
    });
  } catch (e) {
    return NextResponse.json({
      requestId: reqId(), success: false, error: `更新失败：${(e as Error).message}`,
    }, { status: 500 });
  }
}

// ==================== DELETE ====================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';

  try {
    // 1. 读取模型
    const rows = await db.execute<RegistryRow>(sql`SELECT * FROM model_registry WHERE id = ${id} LIMIT 1`);
    if (!rows.rows?.[0]) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '模型不存在' }, { status: 404 });
    }
    const model = rows.rows[0];

    // 2. 检查反向引用（被 Active Workflow 引用的禁止物理删除）
    const refs = (model.referenced_by as Array<{ active?: boolean; workflowId: string }>) ?? [];
    const activeRefs = refs.filter((x) => x.active);

    if (activeRefs.length > 0 && !force) {
      return NextResponse.json({
        requestId: reqId(), success: false,
        error: `模型被 ${activeRefs.length} 个 Active Workflow 引用，禁止删除。请先解除引用或 force=true`,
        details: { activeRefs },
      }, { status: 409 });
    }

    // 3. 删除 Registry 记录（不删物理文件 — 物理删除是独立操作）
    await db.execute(sql`DELETE FROM model_registry WHERE id = ${id}`);

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: {
        deleted: id,
        activeRefsBlocked: activeRefs.length,
        note: 'Registry 记录已删除。物理文件需独立操作。',
      },
    });
  } catch (e) {
    return NextResponse.json({
      requestId: reqId(), success: false, error: `删除失败：${(e as Error).message}`,
    }, { status: 500 });
  }
}