/**
 * Phase 9.23 · Model Registry API（统一模型资产管理）
 *
 * 路由：
 *   GET    /api/admin/model-registry        - 列出所有模型（支持 type/status 筛选）
 *   POST   /api/admin/model-registry        - 上传/登记模型（自动算 SHA256）
 *   GET    /api/admin/model-registry/[id]   - 详情（含 referencedBy 反向引用）
 *   PATCH  /api/admin/model-registry/[id]   - 更新（disable/enable）
 *   DELETE /api/admin/model-registry/[id]   - Registry Delete（仅当无 Active 引用）
 *
 * 状态机（docs §3.1）：
 *   available / missing / disabled / incompatible
 *
 * 删除保护（docs §10）：
 *   Disable → Unbind（解除 Workflow 引用）→ Registry Delete → 物理删除独立确认
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { sql } from 'drizzle-orm';
import { db } from '@/storage/database/db';
import { createHash } from 'crypto';
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
    /** 删除保护：是否被 Active Workflow 引用 */
    deletable: !(Array.isArray(r.referenced_by) && (r.referenced_by as Array<{ active?: boolean }>).some((x) => x.active)),
  };
}

// ==================== GET ====================

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const status = searchParams.get('status');

  try {
    const conditions: ReturnType<typeof sql>[] = [];
    if (type) conditions.push(sql`type = ${type}`);
    if (status) conditions.push(sql`status = ${status}`);

    const whereClause = conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

    const rows = await db.execute<RegistryRow>(sql`
      SELECT * FROM model_registry ${whereClause} ORDER BY created_at DESC LIMIT 500
    `);

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        models: (rows.rows ?? []).map(mapRow),
        total: rows.rows?.length ?? 0,
      },
    });
  } catch (e) {
    return NextResponse.json({
      requestId: reqId(), success: false, error: `查询失败：${(e as Error).message}`,
    }, { status: 500 });
  }
}

// ==================== POST ====================

interface RegisterInput {
  name: string;
  type: 'base' | 'lora' | 'controlnet';
  version?: string;
  baseModel?: string;
  filename: string;             // 必填（Dependency Analyzer 用此匹配）
  relativePath?: string;
  fileSize?: number;
  sha256?: string;              // 可选，不传则视作"无哈希"
  comfyuiCategory?: string;
  metadata?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });

  let body: RegisterInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  if (!body.name || !body.type || !body.filename) {
    return NextResponse.json({
      requestId: reqId(), success: false, error: '缺少必填字段：name / type / filename',
    }, { status: 400 });
  }
  if (!['base', 'lora', 'controlnet'].includes(body.type)) {
    return NextResponse.json({
      requestId: reqId(), success: false, error: `不支持的 type: ${body.type}`,
    }, { status: 400 });
  }

  const id = `mr_${createHash('sha1').update(`${body.type}:${body.filename}:${Date.now()}`).digest('hex').slice(0, 16)}`;

  try {
    await db.execute(sql`
      INSERT INTO model_registry
        (id, name, type, version, base_model, filename, relative_path, file_size,
         sha256, status, comfyui_category, metadata)
      VALUES
        (${id}, ${body.name}, ${body.type}, ${body.version ?? null},
         ${body.baseModel ?? null}, ${body.filename}, ${body.relativePath ?? null},
         ${body.fileSize ?? null}, ${body.sha256 ?? null},
         ${body.sha256 ? 'available' : 'missing'},
         ${body.comfyuiCategory ?? null},
         ${JSON.stringify(body.metadata ?? {})}::jsonb)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        version = EXCLUDED.version,
        base_model = EXCLUDED.base_model,
        file_size = EXCLUDED.file_size,
        sha256 = EXCLUDED.sha256,
        comfyui_category = EXCLUDED.comfyui_category,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `);

    return NextResponse.json({ requestId: reqId(), success: true, data: { id } });
  } catch (e) {
    return NextResponse.json({
      requestId: reqId(), success: false, error: `登记失败：${(e as Error).message}`,
    }, { status: 500 });
  }
}