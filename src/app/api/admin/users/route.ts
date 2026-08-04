import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { desc, like, or, sql } from 'drizzle-orm';

// 导入共享的模拟用户余额（用于开发模式）
import { getMockUserBalance } from './mock-data';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}
export const dynamic = 'force-dynamic';

/**
 * 获取用户列表
 * GET /api/admin/users
 */
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到 /api/admin/users（同一文件内）
 */
export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    const offset = (page - 1) * limit;

    // 开发模式返回模拟数据（跳过权限检查）
    if (!db) {
      const baseMockUsers = [
        { 
          id: 'test-user-001', 
          email: 'test@example.com', 
          nickname: '测试用户', 
          power: getMockUserBalance('test-user-001'), 
          role: 'user', 
          status: 'active', 
          createdAt: new Date().toISOString().split('T')[0], 
          lastLoginAt: new Date().toISOString() 
        },
        { id: '1', email: 'user1@example.com', nickname: '用户A', power: getMockUserBalance('1'), role: 'user', status: 'active', createdAt: '2024-01-15', lastLoginAt: '2024-01-20' },
        { id: '2', email: 'user2@example.com', nickname: '用户B', power: getMockUserBalance('2'), role: 'vip', status: 'active', createdAt: '2024-01-14', lastLoginAt: '2024-01-19' },
        { id: '3', email: 'user3@example.com', nickname: '用户C', power: getMockUserBalance('3'), role: 'user', status: 'inactive', createdAt: '2024-01-13', lastLoginAt: '2024-01-10' },
        { id: '4', email: 'user4@example.com', nickname: '用户D', power: getMockUserBalance('4'), role: 'vip', status: 'active', createdAt: '2024-01-12', lastLoginAt: '2024-01-20' },
        { id: '5', email: 'user5@example.com', nickname: '用户E', power: getMockUserBalance('5'), role: 'user', status: 'banned', createdAt: '2024-01-11', lastLoginAt: '2024-01-05' },
      ];
      
      return NextResponse.json({
        requestId: reqId(), success: true,
        data: {
          users: baseMockUsers,
          pagination: {
            page,
            limit,
            total: baseMockUsers.length,
            totalPages: 1,
          },
        },
        mode: 'mock',
      });
    }

    // 生产环境权限检查
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
    }

    // 构建查询条件
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          like(users.email, `%${search}%`),
          like(users.nickname, `%${search}%`)
        )
      );
    }
    
    if (status) {
      conditions.push(sql`${users.status} = ${status}`);
    }

    // 查询用户列表
    const userList = await db
      .select({
        id: users.id,
        email: users.email,
        nickname: users.nickname,
        avatar: users.avatar,
        role: users.role,
        status: users.status,
        power: users.power,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(conditions.length > 0 ? sql`${conditions.join(' AND ')}` : undefined)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    // 查询总数
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(conditions.length > 0 ? sql`${conditions.join(' AND ')}` : undefined);

    const total = Number(countResult[0]?.count || 0);

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: {
        users: userList.map(u => ({
          ...u,
          createdAt: u.createdAt?.toISOString().split('T')[0] || '',
          lastLoginAt: u.lastLoginAt?.toISOString() || null,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '服务器错误' }, { status: 500 });
  }
}
