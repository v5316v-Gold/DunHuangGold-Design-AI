/**
 * GET  /api/works
 *   ?limit=20&type=text2img&isPublic=false
 *   列出当前用户的作品(分页 / 类型筛选)
 * DELETE /api/works
 *   { ids: string[] }  批量删除(只能删自己的)
 *
 * POST /api/works  内部创建(create-only,或 admin 注入 public)
 *  - 用户无法直接 POST 创建作品;作品由 orchestrator-worker 完成时插入
 *  - 管理员可在测试时用 POST body { ...row } 创建 public 作品
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq, desc, and, inArray, type SQL } from 'drizzle-orm';
import { db } from '@/db';
import { works, favorites, users } from '@/db/schema/_tables';
import { requireAuth } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId() {
  return `req_${randomUUID()}`;
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: '数据库不可用' }, { status: 503 });

  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);
  const type = url.searchParams.get('type');
  const isPublicParam = url.searchParams.get('isPublic');
  const onlyMine = url.searchParams.get('mine') !== 'false'; // 默认只看自己

  const conds: SQL[] = [];
  if (onlyMine) conds.push(eq(works.userId, user.userId));
  if (type) conds.push(eq(works.type, type));
  if (isPublicParam !== null) conds.push(eq(works.isPublic, isPublicParam === 'true'));

  const where = conds.length > 1 ? and(...conds) : conds[0];

  const rows = await db
    .select({
      id: works.id,
      title: works.title,
      type: works.type,
      featureCode: works.featureCode,
      prompt: works.prompt,
      inputImageUrl: works.inputImageUrl,
      outputImageUrl: works.outputImageUrl,
      outputVideoUrl: works.outputVideoUrl,
      outputModelUrl: works.outputModelUrl,
      powerCost: works.powerCost,
      status: works.status,
      isPublic: works.isPublic,
      createdAt: works.createdAt,
    })
    .from(works)
    .where(where ?? undefined)
    .orderBy(desc(works.createdAt))
    .limit(limit);

  return NextResponse.json({ requestId: reqId(), success: true, data: rows });
}

export async function DELETE(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: '数据库不可用' }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 ids[]' }, { status: 400 });
  }
  // 仅删自己的 + 收藏一起删
  const owned = await db
    .select({ id: works.id, userId: works.userId })
    .from(works)
    .where(and(inArray(works.id, body.ids), eq(works.userId, user.userId)));
  const idsOwned = owned.map((r) => r.id);
  if (idsOwned.length === 0) {
    return NextResponse.json({ requestId: reqId(), success: true, data: { deleted: 0 } });
  }
  // 先级联删 favorites,再删 works
  await db.delete(favorites).where(inArray(favorites.workId, idsOwned)).execute();
  await db.delete(works).where(and(inArray(works.id, idsOwned), eq(works.userId, user.userId))).execute();
  return NextResponse.json({ requestId: reqId(), success: true, data: { deleted: idsOwned.length } });
}

/** Admin 创建 public 作品 */
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
  if (user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '需要 admin 权限' }, { status: 403 });
  }
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: '数据库不可用' }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    title?: string;
    type?: string;
    featureCode?: string;
    prompt?: string;
    outputImageUrl?: string;
    outputVideoUrl?: string;
    outputModelUrl?: string;
    isPublic?: boolean;
  };
  if (!body.type) {
    return NextResponse.json({ requestId: reqId(), success: false, error: 'type 必填' }, { status: 400 });
  }

  const [row] = await db
    .insert(works)
    .values({
      userId: body.userId ?? user.userId,
      title: body.title ?? body.type,
      type: body.type,
      featureCode: body.featureCode ?? body.type,
      prompt: body.prompt,
      outputImageUrl: body.outputImageUrl,
      outputVideoUrl: body.outputVideoUrl,
      outputModelUrl: body.outputModelUrl,
      isPublic: body.isPublic ?? true,
      status: 'completed',
      powerCost: 0,
    })
    .returning({ id: works.id });
  return NextResponse.json({ requestId: reqId(), success: true, data: row });
}
