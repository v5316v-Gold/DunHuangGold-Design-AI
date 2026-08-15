/**
 * /api/admin/comfyui/connections/[id]
 * 管理员 · 单个 ComfyUI 连接
 *
 * DELETE /api/admin/comfyui/connections/[id]   - 删除连接
 * POST   /api/admin/comfyui/connections/[id]   - 测试连通性（探测 /system_stats）
 *     Resp: { success, data: { online, latencyMs?, version?, error? } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { comfyuiConnections } from '@/db/schema/_tables';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

/** 组装可访问的 base URL */
function buildBaseUrl(host: string, port: number): string {
  const h = host.trim();
  if (/^https?:\/\//i.test(h)) return h.replace(/\/$/, '');
  return `http://${h}:${port}`;
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
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  const { id } = await params;
  try {
    const dbc = db as NonNullable<typeof db>;
    const result = await dbc
      .delete(comfyuiConnections)
      .where(eq(comfyuiConnections.id, id))
      .returning({ id: comfyuiConnections.id });
    if (result.length === 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '连接不存在' }, { status: 404 });
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

// ==================== POST（测试连通性） ====================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  const { id } = await params;
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: true, data: { online: false, error: '数据库未配置' } });
  }
  const dbc = db as NonNullable<typeof db>;

  let row;
  try {
    const rows = await dbc
      .select()
      .from(comfyuiConnections)
      .where(eq(comfyuiConnections.id, id))
      .limit(1);
    row = rows[0];
  } catch (err) {
    return NextResponse.json({ requestId: reqId(), success: true, data: { online: false, error: `查询失败: ${(err as Error).message}` } });
  }

  if (!row) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '连接不存在' }, { status: 404 });
  }

  const baseUrl = buildBaseUrl(row.host, row.port ?? 8188);
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/system_stats`, {
      method: 'GET',
      headers: row.authToken ? { Authorization: `Bearer ${row.authToken}` } : {},
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    const latencyMs = Date.now() - started;
    if (!res.ok) {
      return NextResponse.json({
        requestId: reqId(),
        success: true,
        data: { online: false, latencyMs, error: `HTTP ${res.status}` },
      });
    }
    const json = await res.json().catch(() => null);
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        online: true,
        latencyMs,
        version: json?.system?.comfyui_version ?? undefined,
        gpu: json?.devices?.[0]?.name ?? undefined,
      },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        online: false,
        latencyMs: Date.now() - started,
        error: (err as Error).name === 'TimeoutError' ? '连接超时' : (err as Error).message,
      },
    });
  }
}
