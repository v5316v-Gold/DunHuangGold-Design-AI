import { NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq, and, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export async function GET(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    const userId = payload.userId;

    // 获取用户的收藏列表（关联作品信息）
    const userFavorites = await db!
      .select({
        id: schema.favorites.id,
        workId: schema.favorites.workId,
        createdAt: schema.favorites.createdAt,
        work: {
          id: schema.works.id,
          title: schema.works.title,
          type: schema.works.type,
          prompt: schema.works.prompt,
          inputImageUrl: schema.works.inputImageUrl,
          outputImageUrl: schema.works.outputImageUrl,
          outputVideoUrl: schema.works.outputVideoUrl,
          params: schema.works.params,
          status: schema.works.status,
          createdAt: schema.works.createdAt,
        },
      })
      .from(schema.favorites)
      .leftJoin(schema.works, eq(schema.favorites.workId, schema.works.id))
      .where(eq(schema.favorites.userId, userId))
      .orderBy(desc(schema.favorites.createdAt));

    const favorites = userFavorites.map((f) => ({
      id: f.id,
      workId: f.workId,
      createdAt: f.createdAt,
      work: f.work,
    }));

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: favorites,
    });
  } catch (error) {
    console.error('[Favorites GET] Error:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '获取收藏列表失败' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    const userId = payload.userId;
    const { workId } = await request.json();
    if (!workId) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少workId' }, { status: 400 });
    }

    // 检查是否已收藏
    const existing = await db!
      .select()
      .from(schema.favorites)
      .where(and(eq(schema.favorites.userId, userId), eq(schema.favorites.workId, workId)))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '已经收藏过了' }, { status: 400 });
    }

    // 创建收藏
    const [newFavorite] = await db!
      .insert(schema.favorites)
      .values({ userId, workId })
      .returning();

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: newFavorite,
    });
  } catch (error) {
    console.error('[Favorites POST] Error:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '添加收藏失败' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }

    const userId = payload.userId;
    const { searchParams } = new URL(request.url);
    const workId = searchParams.get('workId');

    if (!workId) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少workId' }, { status: 400 });
    }

    // 删除收藏
    await db!
      .delete(schema.favorites)
      .where(and(eq(schema.favorites.userId, userId), eq(schema.favorites.workId, workId)));

    return NextResponse.json({ requestId: reqId(), success: true });
  } catch (error) {
    console.error('[Favorites DELETE] Error:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '取消收藏失败' }, { status: 500 });
  }
}
