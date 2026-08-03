import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { features } from '@/db/schema/features';
import { FEATURE_DEFINITIONS, FEATURE_LIST } from '@/config/features';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (db) {
    const rows = await db.select().from(features).where(eq(features.enabled, true));
    return NextResponse.json({
      success: true,
      data: {
        features: rows.map(
          ({ cost: _cost, workflowId: _workflowId, loras: _loras, ...safe }) => safe
        ),
      },
      error: null,
      meta: {},
    });
  }
  return NextResponse.json({
    success: true,
    data: {
      features: FEATURE_LIST.map(({ id, order }) => ({ ...FEATURE_DEFINITIONS[id], order })),
    },
    error: null,
    meta: { source: 'static-fallback' },
  });
}
