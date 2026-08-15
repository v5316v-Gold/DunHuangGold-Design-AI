/**
 * /api/admin/feature-costs
 * 管理员功能算力配置（Phase 9.26 · P2 恢复）
 *
 * 说明：Phase 9.24 清理时误删，但 /admin/features 页 + lib/feature-costs.ts 仍调用。
 * GET: 读当前算力配置（admin）
 * PUT: 保存算力配置（admin）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SETTINGS_KEY = 'feature-costs';

function reqId(): string {
  return `req_${randomUUID()}`;
}

const DEFAULT_FEATURE_COSTS: Record<string, number> = {
  dialogue: 2,
  text2img: 15,
  refine: 20,
  blend: 15,
  oneclick: 15,
  multiview: 20,
  sketch: 15,
  free: 15,
  relief: 20,
  image3d: 30,
  removebg: 5,
  upscale: 5,
  watermark: 5,
  text2video: 50,
  img2video: 40,
  '2dto3d': 25,
  tryon: 25,
};

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  try {
    const baseCosts: Record<string, number> = { ...DEFAULT_FEATURE_COSTS };
    if (db) {
      const rows = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, SETTINGS_KEY))
        .limit(1);
      if (rows.length > 0 && rows[0].value) {
        const stored = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
        for (const [k, v] of Object.entries(stored as Record<string, number>)) {
          baseCosts[k] = v;
        }
      }
    }
    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: { features: Object.entries(baseCosts).map(([feature, cost]) => ({ feature, cost })) },
    });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(), success: false, error: `读取失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ requestId: reqId(), success: false, error: '权限不足' }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { features?: Record<string, number> };
    const features = body.features ?? {};

    // 读取现有配置
    const baseCosts: Record<string, number> = { ...DEFAULT_FEATURE_COSTS };
    if (db) {
      const rows = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, SETTINGS_KEY))
        .limit(1);
      if (rows.length > 0 && rows[0].value) {
        const stored = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
        for (const [k, v] of Object.entries(stored as Record<string, number>)) {
          baseCosts[k] = v;
        }
      }
      // 合并新配置
      for (const [k, v] of Object.entries(features)) {
        if (typeof v === 'number' && v >= 0) baseCosts[k] = v;
      }
      // 写回 system_settings
      await db
        .insert(schema.systemSettings)
        .values({ key: SETTINGS_KEY, value: JSON.stringify(baseCosts) })
        .onConflictDoUpdate({
          target: schema.systemSettings.key,
          set: { value: JSON.stringify(baseCosts) },
        });
    }

    return NextResponse.json({ requestId: reqId(), success: true, data: { features: baseCosts } });
  } catch (err) {
    return NextResponse.json({
      requestId: reqId(), success: false, error: `保存失败: ${(err as Error).message}`,
    }, { status: 500 });
  }
}