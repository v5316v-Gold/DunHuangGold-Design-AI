/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 合并到 /api/works
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/storage/database/db';
import { works } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { UPLOAD_DIR } from '@/lib/storage-config';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('works-download');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    if (!db) return NextResponse.json({ success: false, error: '数据库连接失败' }, { status: 500 });
    const result = await db.select()
      .from(works)
      .where(eq(works.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: '作品不存在' }, { status: 404 });
    }

    const work = result[0];

    if (work.userId !== user.userId && user.role !== 'admin') {
      return NextResponse.json({ success: false, error: '无权下载' }, { status: 403 });
    }

    if (!work.outputImageUrl) {
      return NextResponse.json({ success: false, error: '作品无图片' }, { status: 404 });
    }

    const url = new URL(work.outputImageUrl, 'http://localhost');
    const filename = url.searchParams.get('filename');
    const type = url.searchParams.get('type');

    if (!filename || !type) {
      return NextResponse.json({ success: false, error: '无效的图片路径' }, { status: 400 });
    }

    const filepath = path.join(UPLOAD_DIR, type, filename);

    if (!existsSync(filepath)) {
      return NextResponse.json({ success: false, error: '文件不存在' }, { status: 404 });
    }

    const buffer = readFileSync(filepath);
    const stat = statSync(filepath);

    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };

    const downloadName = `${(work.title || '作品').replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.${ext}`;

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        'Cache-Control': 'private, max-age=3600',
        'X-Deprecated-Source': 'works/[id]/download',
      },
    });

  } catch (error) {
    logger.error('下载失败', error);
    return NextResponse.json({ success: false, error: '下载失败' }, { status: 500 });
  }
}
