import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { features } from '@/db/schema/features';
import { FEATURE_DEFINITIONS } from '@/config/features';
import { requireAuth } from '@/lib/auth';
import { logAudit } from '@/lib/audit-logger';
export const dynamic = 'force-dynamic';
function forbidden() {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: { code: 'FORBIDDEN', message: '需要管理员权限' },
      meta: {},
    },
    { status: 403 }
  );
}
async function admin(request: NextRequest) {
  const user = await requireAuth(request);
  return user && (user.role === 'admin' || user.role === 'superadmin') ? user : null;
}
export async function GET(request: NextRequest) {
  if (!(await admin(request))) return forbidden();
  if (!db)
    return NextResponse.json({
      success: true,
      data: { features: Object.values(FEATURE_DEFINITIONS) },
      error: null,
      meta: {},
    });
  return NextResponse.json({
    success: true,
    data: { features: await db.select().from(features) },
    error: null,
    meta: {},
  });
}
export async function POST(request: NextRequest) {
  const user = await admin(request);
  if (!user || !db) return forbidden();
  const body = await request.json();
  const id = String(body.id || '');
  if (!id || !FEATURE_DEFINITIONS[id])
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: 'INVALID_FEATURE', message: '未知功能' },
        meta: {},
      },
      { status: 400 }
    );
  const definition = FEATURE_DEFINITIONS[id];
  const [row] = await db
    .insert(features)
    .values({
      id,
      name: definition.name,
      description: definition.description,
      category: definition.category,
      icon: definition.icon,
      updatedBy: user.userId,
      fallbackExecutors: ['comfyui', 'mock'],
    })
    .onConflictDoNothing()
    .returning();
  await logAudit({
    action: 'feature.create',
    resourceType: 'feature',
    resourceId: id,
    actorId: user.userId,
  });
  return NextResponse.json({ success: true, data: row, error: null, meta: {} }, { status: 201 });
}
export async function PATCH(request: NextRequest) {
  const user = await admin(request);
  if (!user || !db) return forbidden();
  const body = await request.json();
  const id = String(body.id || '');
  const allowed = [
    'enabled',
    'cost',
    'workflowId',
    'loras',
    'defaultExecutor',
    'fallbackExecutors',
    'defaultModel',
  ];
  const changes = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
  const [row] = await db
    .update(features)
    .set({ ...changes, updatedBy: user.userId, updatedAt: new Date() })
    .where(eq(features.id, id))
    .returning();
  if (!row)
    return NextResponse.json(
      { success: false, data: null, error: { code: 'NOT_FOUND', message: '功能不存在' }, meta: {} },
      { status: 404 }
    );
  await logAudit({
    action: 'feature.update',
    resourceType: 'feature',
    resourceId: id,
    actorId: user.userId,
    details: changes,
  });
  return NextResponse.json({ success: true, data: row, error: null, meta: {} });
}
