/**
 * POST /api/works/batch-delete
 *   Body: { ids: string[] }
 *   批量删除(只能删自己的)。等价于 DELETE /api/works。
 */
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { works, favorites } from '@/db/schema/_tables';
import { requireAuth } from '@/lib/auth';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function reqId() {
  return `req_${randomUUID()}`;
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
  if (!db) return NextResponse.json({ requestId: reqId(), success: false, error: '数据库不可用' }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  if (!Array.isArray(body.ids) || body.ids.length === 0) {
    return NextResponse.json({ requestId: reqId(), success: false, error: '缺少 ids[]' }, { status: 400 });
  }
  const owned = await db
    .select({ id: works.id })
    .from(works)
    .where(and(inArray(works.id, body.ids), eq(works.userId, user.userId)));
  const idsOwned = owned.map((r) => r.id);
  if (idsOwned.length === 0) {
    return NextResponse.json({ requestId: reqId(), success: true, data: { deleted: 0 } });
  }
  await db.delete(favorites).where(inArray(favorites.workId, idsOwned)).execute();
  await db.delete(works).where(and(inArray(works.id, idsOwned), eq(works.userId, user.userId))).execute();
  return NextResponse.json({ requestId: reqId(), success: true, data: { deleted: idsOwned.length } });
}
