/**
 * /api/admin/lora/[id]/toggle
 * 管理员 · 启用/停用 LoRA
 *
 * POST /api/admin/lora/[id]/toggle
 *   Resp: { success, data: { id, enabled } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

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

  try {
    const rows = await db.execute<{ enabled: boolean }>(
      sql`SELECT enabled FROM loras WHERE id = ${id} LIMIT 1`
    );
    const row = rows.rows?.[0];
    if (!row) {
      return NextResponse.json({ requestId: reqId(), success: false, error: 'LoRA 不存在' }, { status: 404 });
    }

    const enabled = !row.enabled;
    await db.execute(
      sql`UPDATE loras SET enabled = ${enabled}, updated_at = NOW() WHERE id = ${id}`
    );

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { id, enabled },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `切换失败（loras 表可能不存在）: ${(err as Error).message}`,
    }, { status: 500 });
  }
}
