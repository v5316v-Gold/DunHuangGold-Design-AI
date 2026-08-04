/**
 * POST /api/admin/lora/[id]/toggle
 *
 * 切换 LoRA 启用/停用
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { DrizzleLoraManager } from '@/lib/ai-gateway/adapters/lora-db';
import { unauthorized, notFound } from '@/lib/api-response';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin(request);
  if (!admin) return unauthorized();

  try {
    const { id } = await params;
    const mgr = new DrizzleLoraManager();

    const lora = await mgr.findById(id);
    if (!lora) return notFound('LoRA 不存在');

    // listAll 返回完整字段（含 enabled 字段），我们扩展接口
    const all = await mgr.listAllWithEnabled();
    const target = all.find((l) => l.id === id);
    if (!target) return notFound('LoRA 不存在');

    const newEnabled = !target.enabled;
    await mgr.setEnabled(id, newEnabled);

    return NextResponse.json({
      requestId: reqId(), success: true,
      id,
      enabled: newEnabled,
    });
  } catch (err) {
    return NextResponse.json(
      {  error: err instanceof Error ? err.message : '切换失败' },
      { status: 500 }
    );
  }
}