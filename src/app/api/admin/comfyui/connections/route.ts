/**
 * /api/admin/comfyui/connections
 * 管理员 · ComfyUI 连接管理（comfyui_connections 表）
 *
 * GET  - 连接列表（data 为数组；按 isDefault desc, priority asc 排序）
 * POST - 新建/更新连接（upsert by id；isDefault=true 时先取消其他默认）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { comfyuiConnections } from '@/db/schema/_tables';
import { eq, desc, asc } from 'drizzle-orm';
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
      .from(comfyuiConnections)
      .orderBy(desc(comfyuiConnections.isDefault), asc(comfyuiConnections.priority));
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
      warning: `查询失败（comfyui_connections 表可能不存在）: ${(err as Error).message}`,
    });
  }
}

// ==================== POST（新建 / 更新） ====================

interface SaveInput {
  id?: string;
  name?: string;
  host?: string;
  port?: number;
  authToken?: string;
  enabled?: boolean;
  isDefault?: boolean;
  priority?: number;
  timeout?: number;
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

  const name = (body.name || '').trim();
  const host = (body.host || '').trim();
  if (!name || !host) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少必填字段：name / host' }, { status: 400 });
  }

  const id = typeof body.id === 'string' && body.id ? body.id : `conn_${randomUUID()}`;
  const isDefault = body.isDefault ?? false;

  const dbc = db as NonNullable<typeof db>;
  try {
    if (isDefault) {
      // 取消其他默认
      await dbc
        .update(comfyuiConnections)
        .set({ isDefault: false })
        .where(eq(comfyuiConnections.isDefault, true));
    }

    const values = {
      name,
      host,
      port: Number(body.port) || 8188,
      authToken: body.authToken ?? null,
      enabled: body.enabled ?? true,
      isDefault,
      priority: Number(body.priority) || 0,
      timeout: Number(body.timeout) || 120000,
      updatedAt: new Date(),
    };

    await dbc
      .insert(comfyuiConnections)
      .values({ id, ...values })
      .onConflictDoUpdate({
        target: comfyuiConnections.id,
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
