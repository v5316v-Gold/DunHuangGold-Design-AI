/**
 * /api/admin/users/[id]/recharge
 * 管理员 · 为用户充值算力
 *
 * POST /api/admin/users/[id]/recharge
 *   Body: { amount: number, reason?: string }
 *   Resp: { success, data: { userId, newBalance } }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { adjustUserPower } from '@/lib/admin/power-ops';
import { logAudit } from '@/lib/audit-logger';
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

  let body: { amount?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const amount = Math.trunc(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ requestId: reqId(), success: false, error: 'amount 必须是正数' }, { status: 400 });
  }

  const result = await adjustUserPower({
    userId: id,
    delta: amount,
    type: 'recharge',
    reason: body.reason || '管理员充值',
    operatorId: user.userId,
    operatorEmail: user.email,
  });

  if (!result) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '用户不存在或充值失败' }, { status: 404 });
  }

  await logAudit({
    action: 'power-recharge',
    resourceType: 'user',
    resourceId: id,
    actorId: user.userId,
    actorEmail: user.email,
    actorRole: user.role,
    details: { amount, balanceAfter: result.balanceAfter },
  });

  return NextResponse.json({
    requestId: reqId(),
    success: true,
    data: { userId: id, newBalance: result.balanceAfter },
  });
}
