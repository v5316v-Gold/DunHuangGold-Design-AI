/**
 * GET    /api/works/[id]  查询单条作品(仅本人 / 仅 public)
 * PATCH  /api/works/[id]  更新标题 / isPublic(仅本人)
 * DELETE /api/works/[id]  删除(仅本人,级联 favorites)
 */
import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { works, favorites } from '@/db/schema/_tables';
import { requireAuth } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId() {
  return `req_${randomUUID()}`;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: '数据库不可用' }, { status: 503 });
  const { id } = await params;
  const [row] = await db.select().from(works).where(eq(works.id, id)).limit(1);
  if (!row) return NextResponse.json({ requestId: reqId(), success: false, error: '作品不存在' }, { status: 404 });
  if (row.userId !== user.userId && !row.isPublic) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '无权查看' }, { status: 403 });
  }
  return NextResponse.json({ requestId: reqId(), success: true, data: row });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: '数据库不可用' }, { status: 503 });
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { title?: string; isPublic?: boolean };
  await db
    .update(works)
    .set({
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.isPublic !== undefined ? { isPublic: !!body.isPublic } : {}),
    })
    .where(and(eq(works.id, id), eq(works.userId, user.userId)))
    .execute();
  return NextResponse.json({ requestId: reqId(), success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: '数据库不可用' }, { status: 503 });
  const { id } = await params;
  await db.delete(favorites).where(eq(favorites.workId, id)).execute();
  await db.delete(works).where(and(eq(works.id, id), eq(works.userId, user.userId))).execute();
  return NextResponse.json({ requestId: reqId(), success: true });
}
