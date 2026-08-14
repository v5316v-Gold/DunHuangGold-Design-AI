/**
 * 公共功能算力接口（无需鉴权，所有用户可读）
 *
 * 数据源：system_settings.key='feature-costs'
 * 作用：让前端 AIDialog 等所有功能能从后端读最新算力
 *
 * 与 /api/admin/feature-costs 区别：
 * - admin 路由：需要 admin 鉴权，可读写
 * - 本路由：无需鉴权，只读，合并默认值
 */

import { NextResponse } from 'next/server';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/* eslint-disable @typescript-eslint/no-explicit-any */


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

const SETTINGS_KEY = 'feature-costs';

export async function GET() {
  try {
    const baseCosts: Record<string, number> = { ...DEFAULT_FEATURE_COSTS };
    let merged: Record<string, number> = { ...baseCosts };

    if (db) {
      const rows = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.key, SETTINGS_KEY))
        .limit(1);

      if (rows.length > 0 && rows[0].value) {
        try {
          const stored = typeof rows[0].value === 'string'
            ? JSON.parse(rows[0].value)
            : rows[0].value;
          // 合并：DB 覆盖默认值
          for (const [k, v] of Object.entries(stored)) {
            if (typeof v === 'number') {
              merged = { ...merged, [k]: v };
            } else if (typeof v === 'object' && v && 'cost' in v) {
              merged = { ...merged, [k]: Number((v as any).cost) || merged[k] };
            }
          }
        } catch (e) {
          console.error('[feature-costs] 解析失败:', e);
        }
      }
    }

    return NextResponse.json({
      requestId: reqId(),
      success: true,
      data: {
        costs: merged,
        source: db ? 'db+defaults' : 'defaults-only',
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        requestId: reqId(),
        success: false,
        error: err instanceof Error ? err.message : String(err),
        data: { costs: DEFAULT_FEATURE_COSTS },
      },
      { status: 200 } // 即使失败也返回默认值
    );
  }
}
