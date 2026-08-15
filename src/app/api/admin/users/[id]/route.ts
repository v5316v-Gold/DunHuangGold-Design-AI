/**
 * /api/admin/users/[id]
 * 管理员 · 单个用户操作
 *
 * PATCH /api/admin/users/[id]   - 更新状态/角色/昵称
 *                                 Body: { status?, role?, nickname? }
 * POST  /api/admin/users/[id]   - 充值（兼容调用方，等价于 /recharge）
 *                                 Body: { amount, reason? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, type JwtPayload } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema/_tables';
import { eq } from 'drizzle-orm';
import { adjustUserPower } from '@/lib/admin/power-ops';
import { logAudit } from '@/lib/audit-logger';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId(): string {
  return `req_${randomUUID()}`;
}

function isAdmin(user: JwtPayload | null): user is JwtPayload {
  return !!user && user.role === 'admin';
}

const VALID_STATUS = ['active', 'inactive', 'banned'];
const VALID_ROLES = ['user', 'vip', 'admin'];

/** 剔除敏感字段（password_hash） */
function sanitizeUser(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };
  delete out.passwordHash;
  return out;
}

// ==================== PATCH（状态/角色） ====================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!isAdmin(user)) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  const { id } = await params;

  let body: { status?: string; role?: string; nickname?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  if (body.status !== undefined && !VALID_STATUS.includes(body.status)) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `status 必须是 ${VALID_STATUS.join(' / ')}`,
    }, { status: 400 });
  }
  if (body.role !== undefined && !VALID_ROLES.includes(body.role)) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `role 必须是 ${VALID_ROLES.join(' / ')}`,
    }, { status: 400 });
  }

  const setFields: Partial<Record<string, unknown>> = {};
  if (body.status !== undefined) setFields.status = body.status;
  if (body.role !== undefined) setFields.role = body.role;
  if (body.nickname !== undefined) setFields.nickname = body.nickname;
  if (Object.keys(setFields).length === 0) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少更新字段：status / role / nickname' }, { status: 400 });
  }
  setFields.updatedAt = new Date();

  try {
    const dbc = db as NonNullable<typeof db>;
    const [updated] = await dbc
      .update(users)
      .set(setFields)
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '用户不存在' }, { status: 404 });
    }

    await logAudit({
      action: 'user-update',
      resourceType: 'user',
      resourceId: id,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: user.role,
      details: setFields,
      ipAddress: request.headers.get('x-forwarded-for') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { user: sanitizeUser(updated as unknown as Record<string, unknown>) },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: `更新失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}

// ==================== POST（充值，兼容别名） ====================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!isAdmin(user)) {
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
