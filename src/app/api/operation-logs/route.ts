/**
 * 操作日志 API
 * 记录和查询用户操作历史
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { powerLogs } from '@/db/schema';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { createLogger } from '@/lib/error-handler';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

const logger = createLogger('operation-logs');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/operation-logs - 获取操作日志
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    if (!db) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未连接' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // add, deduct
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // 构建查询条件
    const conditions = [eq(powerLogs.userId, user.userId)];

    if (type) {
      conditions.push(eq(powerLogs.type, type as 'add' | 'deduct' | 'set'));
    }

    if (startDate) {
      conditions.push(gte(powerLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(powerLogs.createdAt, new Date(endDate)));
    }

    const results = await db
      .select()
      .from(powerLogs)
      .where(and(...conditions))
      .orderBy(desc(powerLogs.createdAt))
      .limit(limit)
      .offset(offset);

    // 格式化返回数据
    const formattedLogs = results.map(log => ({
      id: log.id,
      type: log.type,
      amount: log.amount,
      balance: log.balance,
      reason: log.reason,
      relatedId: log.relatedId,
      createdAt: log.createdAt,
      // 友好描述
      description: formatLogDescription(log),
    }));

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: formattedLogs,
      total: formattedLogs.length,
    });

  } catch (error) {
    logger.error('获取操作日志失败', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '获取失败' }, { status: 500 });
  }
}

/**
 * POST /api/operation-logs - 记录操作（供内部服务调用）
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }


    if (!db) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未连接' }, { status: 500 });
    }
    const body = await request.json();
    const { type, amount, balance, reason, relatedId } = body;

    if (!type || amount === undefined || balance === undefined) {
      return NextResponse.json({
        requestId: reqId(), success: false,
        error: '缺少必填参数：type, amount, balance'
      }, { status: 400 });
    }

    const result = await db
      .insert(powerLogs)
      .values({
        userId: user.userId,
        type,
        amount,
        balance,
        reason: reason || null,
        relatedId: relatedId || null,
      })
      .returning();

    return NextResponse.json({ requestId: reqId(), success: true, data: result[0] });

  } catch (error) {
    logger.error('记录操作日志失败', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '记录失败' }, { status: 500 });
  }
}

/**
 * 格式化日志描述
 */
function formatLogDescription(log: typeof powerLogs.$inferSelect): string {
  const typeLabels: Record<string, string> = {
    add: '充值',
    deduct: '消耗',
    set: '设置',
  };

  const base = typeLabels[log.type] || log.type;

  if (log.reason) {
    return `${base} ${log.amount} 算力 - ${log.reason}`;
  }

  return `${base} ${log.amount} 算力`;
}
