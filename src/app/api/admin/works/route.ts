/**
 * 管理后台作品审核 API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { works } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET - 获取待审核作品
export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
    }

    if (!db) {
      // Mock数据
      return NextResponse.json({
        requestId: reqId(), success: true,
        data: [],
      });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');

    const results = await db
      .select()
      .from(works)
      .orderBy(desc(works.createdAt))
      .limit(limit);

    return NextResponse.json({ requestId: reqId(), success: true, data: results });

  } catch (error) {
    console.error('[admin/works]', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '获取失败' }, { status: 500 });
  }
}

// POST - 审核操作（通过/拒绝）
export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
    }

    const body = await request.json();
    const { action, id } = body;

    if (!id) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少作品ID' }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ requestId: reqId(), success: true, message: `作品 ${id} 已${action === 'approve' ? '通过' : '拒绝'}` });
    }

    await db
      .update(works)
      .set({ 
        status: action === 'approve' ? 'completed' : 'failed',
      })
      .where(eq(works.id, id));
    
    return NextResponse.json({ requestId: reqId(), success: true, message: `作品 ${id} 已${action === 'approve' ? '通过' : '拒绝'}` });

    return NextResponse.json({ requestId: reqId(), success: false, error: '未知操作' }, { status: 400 });

  } catch (error) {
    console.error('[admin/works]', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '操作失败' }, { status: 500 });
  }
}
