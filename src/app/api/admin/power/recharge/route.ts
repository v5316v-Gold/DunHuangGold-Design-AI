/**
 * /api/admin/power/recharge
 * 管理员 · 统一充值/扣除算力（算力管理页使用）
 *
 * POST /api/admin/power/recharge
 *   Body: { userId, amount, type?: 'recharge' | 'deduct', reason?: string }
 *   Resp: { success, data: { userId, newBalance, delta, type } }
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

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  let body: { userId?: string; amount?: number; type?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const { userId } = body;
  const amount = Math.trunc(Number(body.amount));
  if (!userId) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 userId' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ requestId: reqId(), success: false, error: 'amount 必须是正数' }, { status: 400 });
  }

  const type = body.type === 'deduct' ? 'deduct' : 'recharge';
  const delta = type === 'deduct' ? -amount : amount;
  const reason = body.reason || (type === 'deduct' ? '管理员扣除' : '管理员充值');

  const result = await adjustUserPower({
    userId,
    delta,
    type,
    reason,
    operatorId: user.userId,
    operatorEmail: user.email,
  });

  if (!result) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '用户不存在或操作失败' }, { status: 404 });
  }

  await logAudit({
    action: type === 'deduct' ? 'power-deduct' : 'power-recharge',
    resourceType: 'user',
    resourceId: userId,
    actorId: user.userId,
    actorEmail: user.email,
    actorRole: user.role,
    details: { delta, reason, balanceAfter: result.balanceAfter },
  });

  return NextResponse.json({
    requestId: reqId(),
    success: true,
    data: { userId, newBalance: result.balanceAfter, delta, type },
  });
}
