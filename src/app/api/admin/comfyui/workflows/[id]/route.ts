/**
 * /api/admin/comfyui/workflows/[id]
 * 管理员 · 单个 ComfyUI 工作流配置
 *
 * DELETE /api/admin/comfyui/workflows/[id]   - 删除
 * POST   /api/admin/comfyui/workflows/[id]   - 启用/停用（body: { action: 'enable' | 'disable' }）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { comfyuiConfigs } from '@/db/schema/_tables';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
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
      .delete(comfyuiConfigs)
      .where(eq(comfyuiConfigs.id, id))
      .returning({ id: comfyuiConfigs.id });
    if (result.length === 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '工作流不存在' }, { status: 404 });
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

// ==================== POST（启用 / 停用） ====================

export async function POST(
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

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  if (body.action !== 'enable' && body.action !== 'disable') {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: "action 必须是 'enable' 或 'disable'",
    }, { status: 400 });
  }

  try {
    const dbc = db as NonNullable<typeof db>;
    const [updated] = await dbc
      .update(comfyuiConfigs)
      .set({ enabled: body.action === 'enable', updatedAt: new Date() })
      .where(eq(comfyuiConfigs.id, id))
      .returning({ id: comfyuiConfigs.id, enabled: comfyuiConfigs.enabled });

    if (!updated) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '工作流不存在' }, { status: 404 });
    }

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { id, enabled: updated.enabled },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `操作失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
