import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/storage/database/db';
import { works } from '@/storage/database/shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { createLogger } from '@/lib/error-handler';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

const logger = createLogger('works');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/works - 获取用户作品列表
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
    const type = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const queryConditions = [eq(works.userId, user.userId)];
    if (type) {
      queryConditions.push(eq(works.type, type));
    }

    const results = await db
      .select()
      .from(works)
      .where(and(...queryConditions))
      .orderBy(desc(works.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: results,
      total: results.length
    });

  } catch (error) {
    logger.error('[works] 获取列表失败:');
    return NextResponse.json({ requestId: reqId(), success: false, error: '获取失败' }, { status: 500 });
  }
}

/**
 * POST /api/works - 创建作品记录
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
    const { title, type, prompt, inputImageUrl, outputImageUrl, outputVideoUrl, outputModelUrl } = body;

    if (!title || !type) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少必填参数' }, { status: 400 });
    }

    const result = await db.insert(works).values({
      userId: user.userId,
      title,
      type,
      prompt: prompt || null,
      inputImageUrl: inputImageUrl || null,
      outputImageUrl: outputImageUrl || null,
      outputVideoUrl: outputVideoUrl || null,
      outputModelUrl: outputModelUrl || null,
    }).returning();

    return NextResponse.json({ requestId: reqId(), success: true, data: result[0] });

  } catch (error) {
    logger.error('[works] 创建失败:');
    return NextResponse.json({ requestId: reqId(), success: false, error: '创建失败' }, { status: 500 });
  }
}
