/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到 /api/works
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/storage/database/db';
import { works } from '@/storage/database/shared/schema';
import { inArray } from 'drizzle-orm';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';
import { UPLOAD_DIR } from '@/lib/storage-config';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('works-batch-delete');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, error: '请提供要删除的作品ID列表' }, { status: 400 });
    }

    if (!db) return NextResponse.json({ success: false, error: '数据库连接失败' }, { status: 500 });

    const isAdmin = user.role === 'admin';

    const worksToDelete = await db.select()
      .from(works)
      .where(inArray(works.id, ids));

    if (worksToDelete.length === 0) {
      return NextResponse.json({ success: false, error: '没有找到要删除的作品' }, { status: 404 });
    }

    if (!isAdmin) {
      const unauthorized = worksToDelete.filter(a => a.userId !== user.userId);
      if (unauthorized.length > 0) {
        return NextResponse.json({ success: false, error: '无权删除部分作品' }, { status: 403 });
      }
    }

    for (const work of worksToDelete) {
      if (work.outputImageUrl) {
        try {
          const url = new URL(work.outputImageUrl, 'http://localhost');
          const filename = url.searchParams.get('filename');
          const type = url.searchParams.get('type');
          
          if (filename && type) {
            const filepath = path.join(UPLOAD_DIR, type, filename);
            if (existsSync(filepath)) {
              await unlink(filepath as string);
            }
          }
        } catch (e) {
          logger.warn('删除文件失败', e);
        }
      }
    }

    await db.delete(works).where(inArray(works.id, ids));

    logger.info('批量删除完成', { userId: user.userId, deletedCount: ids.length });

    return NextResponse.json({ 
      success: true, 
      message: `成功删除 ${ids.length} 个作品`,
      deletedCount: ids.length,
    });

  } catch (error) {
    logger.error('批量删除失败', error);
    return NextResponse.json({ success: false, error: '批量删除失败' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: '此路由已废弃，请使用 POST /api/works',
      deprecated: true,
      migration: 'POST /api/works with { ids: string[] } in body',
    },
    { status: 410, headers: { 'X-Deprecated-Source': 'works/batch-delete' } }
  );
}
