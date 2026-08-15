/**
 * /api/admin/comfyui/workflows
 * 管理员 · ComfyUI 工作流配置（comfyui_configs 表）
 *
 * GET  - 工作流列表（data 为数组，附带 connection 对象 {id,name,host,port}）
 * POST - 新建/更新工作流（upsert by id；isDefault=true 时先取消其他默认）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { comfyuiConfigs, comfyuiConnections } from '@/db/schema/_tables';
import { eq, desc } from 'drizzle-orm';
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
    const [configs, conns] = await Promise.all([
      dbc.select().from(comfyuiConfigs).orderBy(desc(comfyuiConfigs.createdAt)),
      dbc.select().from(comfyuiConnections),
    ]);
    const connMap = new Map(conns.map((c) => [c.id, { id: c.id, name: c.name, host: c.host, port: c.port }]));

    const items = configs.map((wf) => ({
      ...wf,
      connection: wf.connectionId ? connMap.get(wf.connectionId) ?? null : null,
    }));
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: items,
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: [],
      warning: `查询失败（comfyui_configs 表可能不存在）: ${(err as Error).message}`,
    });
  }
}

// ==================== POST（新建 / 更新） ====================

interface SaveInput {
  id?: string;
  featureId?: string;
  workflowId?: string;
  workflowJson?: unknown;
  nodeMapping?: Record<string, unknown>;
  defaultParams?: Record<string, unknown>;
  fixedParams?: Record<string, unknown>;
  connectionId?: string;
  enabled?: boolean;
  isDefault?: boolean;
  description?: string;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  let body: SaveInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const featureId = (body.featureId || '').trim();
  if (!featureId) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少必填字段：featureId' }, { status: 400 });
  }

  const id = typeof body.id === 'string' && body.id ? body.id : `wf_${randomUUID()}`;
  const isDefault = body.isDefault ?? false;

  const dbc = db as NonNullable<typeof db>;
  try {
    if (isDefault) {
      await dbc
        .update(comfyuiConfigs)
        .set({ isDefault: false })
        .where(eq(comfyuiConfigs.isDefault, true));
    }

    const values = {
      featureId,
      workflowId: body.workflowId ?? null,
      workflowJson: body.workflowJson ?? null,
      nodeMapping: body.nodeMapping ?? {},
      defaultParams: body.defaultParams ?? {},
      fixedParams: body.fixedParams ?? {},
      connectionId: body.connectionId ?? null,
      enabled: body.enabled ?? false,
      isDefault,
      description: body.description ?? null,
      updatedAt: new Date(),
    };

    await dbc
      .insert(comfyuiConfigs)
      .values({ id, ...values })
      .onConflictDoUpdate({
        target: comfyuiConfigs.id,
        // 不重置 executionCount / lastExecutedAt（保留历史）
        set: { ...values, id },
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
