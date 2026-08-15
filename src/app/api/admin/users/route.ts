/**
 * /api/admin/users
 * 管理员 · 用户管理
 *
 * GET  /api/admin/users?search=&page=&limit=&status=   - 用户列表（分页/搜索/状态过滤）
 * POST /api/admin/users                                - 调整用户算力（充值/扣除/奖励）
 *                                                       Body: { userId, amount, type?, reason? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, type JwtPayload } from '@/lib/auth';
import { db } from '@/db';
import { usersRepository } from '@/db/repositories/users-repository';
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

/** 计算某类型操作的净额：deduct/consume 为负，其余为正 */
function deltaForType(amount: number, type: string): number {
  return type === 'deduct' || type === 'consume' ? -Math.abs(amount) : Math.abs(amount);
}

// ==================== GET ====================

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!isAdmin(user)) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(searchParams.get('limit') || searchParams.get('pageSize') || '50', 10) || 50)
  );
  const search = searchParams.get('search') || undefined;
  const status = searchParams.get('status') || undefined;

  try {
    const { items, total } = await usersRepository.list({
      limit,
      offset: (page - 1) * limit,
      search,
      status,
      orderByCreated: 'desc',
    });
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        users: items,
        pagination: {
          page,
          pageSize: limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (err) {
    // 表不存在 / 查询失败：返回空列表 + 明确错误信息，不 500 崩溃
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        users: [],
        pagination: { page, pageSize: limit, total: 0, totalPages: 1 },
      },
      warning: `查询失败（users 表可能不存在或不可用）: ${(err as Error).message}`,
    });
  }
}

// ==================== POST（充值/调整算力） ====================

interface AdjustInput {
  userId?: string;
  id?: string;
  amount?: number;
  /** recharge | deduct | bonus | refund | consume，默认 recharge */
  type?: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!isAdmin(user)) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }
  if (!db) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未配置' }, { status: 503 });
  }

  let body: AdjustInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ requestId: reqId(), success: false, error: '请求体非法 JSON' }, { status: 400 });
  }

  const userId = body.userId || body.id;
  const amount = Math.trunc(Number(body.amount));
  if (!userId) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 userId' }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ requestId: reqId(), success: false, error: 'amount 必须是非零数字' }, { status: 400 });
  }

  const type = body.type || 'recharge';
  const delta = deltaForType(amount, type);
  const reason = body.reason || (delta < 0 ? '管理员扣除' : '管理员充值');

  const result = await adjustUserPower({
    userId,
    delta,
    type,
    reason,
    operatorId: user.userId,
    operatorEmail: user.email,
  });

  if (!result) {
    return NextResponse.json({
      requestId: reqId(),
      success: false,
      error: '用户不存在或算力调整失败',
    }, { status: 404 });
  }

  await logAudit({
    action: 'power-adjust',
    resourceType: 'user',
    resourceId: userId,
    actorId: user.userId,
    actorEmail: user.email,
    actorRole: user.role,
    details: { delta, type, reason, balanceAfter: result.balanceAfter },
    ipAddress: request.headers.get('x-forwarded-for') || undefined,
    userAgent: request.headers.get('user-agent') || undefined,
  });

  return NextResponse.json({
    requestId: reqId(),
    success: true,
    data: { userId, newBalance: result.balanceAfter, delta, type },
  });
}
