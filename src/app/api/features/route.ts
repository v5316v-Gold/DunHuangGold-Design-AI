import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { features } from '@/db/schema/features';
import { FEATURE_DEFINITIONS, FEATURE_LIST } from '@/config/features';

export const dynamic = 'force-dynamic';

/**
 * GET /api/features
 * 公开功能列表（Sidebar / WorkspacePanel 共用）
 *
 * 数据源优先级：
 *   1. DB features 表（enabled=true）
 *   2. 静态 FEATURE_DEFINITIONS（开发/Dev fallback）
 *
 * 修复 2026-08-04：原代码 if (db) 走 DB 分支，但 db 已被 module-load 创建，
 * 即使无 DATABASE_URL。DB query 失败会抛错导致 500。
 * 现在 try-catch 兜底，确保 fallback 永远生效。
 */
export async function GET() {
  // 1. 尝试 DB
  try {
    if (db) {
      const rows = await db
        .select()
        .from(features)
        .where(eq(features.enabled, true));
      // 过滤敏感字段
      const safeRows = rows.map(({ cost: _c, workflowId: _w, loras: _l, ...safe }) => safe);
      if (safeRows.length > 0) {
        return NextResponse.json({
          success: true,
          data: { features: safeRows, source: 'database' },
          error: null,
          meta: {},
        });
      }
      // DB 通了但表为空：继续 fallback
    }
  } catch (err) {
    // DB query 失败（连接错误/表不存在/超时）→ fallback
    console.warn('[api/features] DB query 失败,使用静态 fallback:', (err as Error).message);
  }

  // 2. 静态 fallback（开发环境 / DB 不可用时）
  return NextResponse.json({
    success: true,
    data: {
      features: FEATURE_LIST.map(({ id, order }) => ({ ...FEATURE_DEFINITIONS[id], order })),
      source: 'static-fallback',
    },
    error: null,
    meta: {},
  });
}
