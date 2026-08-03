import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { powerTransactions } from '@/db/schema/power-transactions';
import { desc, eq, and, gte, lte, like, or } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * 获取算力流水记录
 * GET /api/admin/power/transactions
 */
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到 /api/admin/power GET
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    
    // 权限检查
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const search = searchParams.get('search'); // 搜索用户邮箱或昵称

    const offset = (page - 1) * pageSize;

    // 构建查询条件
    const conditions = [];
    
    if (userId) {
      conditions.push(eq(powerTransactions.userId, userId));
    }
    
    if (type) {
      conditions.push(eq(powerTransactions.type, type));
    }
    
    if (startDate) {
      conditions.push(gte(powerTransactions.createdAt, new Date(startDate)));
    }
    
    if (endDate) {
      conditions.push(lte(powerTransactions.createdAt, new Date(endDate + 'T23:59:59')));
    }
    
    if (search) {
      conditions.push(
        or(
          like(powerTransactions.userEmail, `%${search}%`),
          like(powerTransactions.userNickname, `%${search}%`)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 检查数据库连接
    if (!db) {
      return NextResponse.json({ success: false, error: '数据库未连接' }, { status: 500 });
    }

    // 查询数据
    const [transactions, countResult] = await Promise.all([
      db
        .select()
        .from(powerTransactions)
        .where(whereClause)
        .orderBy(desc(powerTransactions.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select()
        .from(powerTransactions)
        .where(whereClause),
    ]);

    const total = countResult.length;

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    });
  } catch (error) {
    console.error('[Power Transactions] 获取流水失败:', error);
    return NextResponse.json({ success: false, error: '服务器错误' }, { status: 500 });
  }
}
