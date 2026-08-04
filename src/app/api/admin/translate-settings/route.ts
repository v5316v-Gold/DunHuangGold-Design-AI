/**
 * 翻译设置 API
 * CRUD operations for translate_settings table
 */
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到 /api/admin/settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { translateSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sanitizeError } from '@/lib/validators';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 获取翻译设置
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }
    if (!db) {
      // console.error('[translate-settings] 数据库未连接');
      return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未连接' }, { status: 500 });
    }
    
    const result = await db.select().from(translateSettings).where(eq(translateSettings.id, 'default')).limit(1);

    const settings = result.length > 0 ? result[0] : {
      id: 'default',
      preserveNewline: true,
      removeRedundantDots: false,
      removeExtraSpaces: false,
      halfwidthPunctuation: false,
      mixedLangRule: 'to_en',
      cacheMixedLang: false,
      useCache: true,
    };

    return NextResponse.json({
      requestId: reqId(), success: true,
      data: {
        preserveNewline: settings.preserveNewline,
        removeRedundantDots: settings.removeRedundantDots,
        removeExtraSpaces: settings.removeExtraSpaces,
        halfwidthPunctuation: settings.halfwidthPunctuation,
        mixedLangRule: settings.mixedLangRule,
        cacheMixedLang: settings.cacheMixedLang,
        useCache: settings.useCache,
      },
    });

  } catch (err: unknown) {
    // console.error('[translate-settings] 获取设置失败:', error);
    return NextResponse.json({
      requestId: reqId(), success: false,
      error: sanitizeError(err, '获取设置失败').message,
    }, { status: 500 });
  }
}

// 更新翻译设置
export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '未登录' }, { status: 401 });
    }
    if (!db) {
      // console.error('[translate-settings] 数据库未连接');
      return NextResponse.json({ requestId: reqId(), success: false, error: '数据库未连接' }, { status: 500 });
    }
    
    const updates = await request.json();

    const dbUpdates: any = {
      preserveNewline: updates.preserveNewline,
      removeRedundantDots: updates.removeRedundantDots,
      removeExtraSpaces: updates.removeExtraSpaces,
      halfwidthPunctuation: updates.halfwidthPunctuation,
      mixedLangRule: updates.mixedLangRule,
      cacheMixedLang: updates.cacheMixedLang,
      useCache: updates.useCache,
      updatedAt: new Date(),
    };

    // Upsert
    const existing = await db.select().from(translateSettings).where(eq(translateSettings.id, 'default')).limit(1);

    if (existing.length > 0) {
      await db.update(translateSettings).set(dbUpdates).where(eq(translateSettings.id, 'default'));
    } else {
      await db.insert(translateSettings).values({
        id: 'default',
        ...dbUpdates,
      });
    }

    return NextResponse.json({ requestId: reqId(), success: true, message: '设置更新成功' });

  } catch (err: unknown) {
    // console.error('[translate-settings] 更新设置失败:', error);
    return NextResponse.json({
      requestId: reqId(), success: false,
      error: sanitizeError(err, '更新设置失败').message,
    }, { status: 500 });
  }
}
