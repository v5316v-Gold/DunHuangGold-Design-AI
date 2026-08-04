import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { unauthorized, forbidden, notFound, internalError } from '@/lib/api-response';
import { db } from '@/storage/database/db';
import { works } from '@/storage/database/shared/schema';
import { eq } from 'drizzle-orm';
import { existsSync } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';
import { UPLOAD_DIR } from '@/lib/storage-config';
import { createLogger } from '@/lib/error-handler';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

const logger = createLogger('works-id');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/works/[id] - 获取单个作品
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorized('未登录');
    }

    const { id } = await params;
    const result = await db!.select()
      .from(works)
      .where(eq(works.id, id))
      .limit(1);

    if (result.length === 0) {
      return notFound('作品不存在');
    }

    const work = result[0];
    
    if (work.userId !== user.userId && user.role !== 'admin') {
      return forbidden('无权访问');
    }

    return NextResponse.json({ requestId: reqId(), success: true, data: work });

  } catch (error) {
    logger.error('获取失败', error);
    return internalError(error, '获取失败');
  }
}

/**
 * DELETE /api/works/[id] - 删除作品
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return unauthorized('未登录');
    }

    const { id } = await params;
    const result = await db!.select()
      .from(works)
      .where(eq(works.id, id))
      .limit(1);

    if (result.length === 0) {
      return notFound('作品不存在');
    }

    const work = result[0];

    if (work.userId !== user.userId && user.role !== 'admin') {
      return forbidden('无权删除');
    }

    if (work.outputImageUrl) {
      try {
        const url = new URL(work.outputImageUrl, 'http://localhost');
        const filename = url.searchParams.get('filename');
        const type = url.searchParams.get('type');
        
        if (filename && type) {
          const filepath = path.join(UPLOAD_DIR, type, filename);
          if (existsSync(filepath)) {
            await unlink(filepath as string);
            logger.info('已删除文件', { filepath });
          }
        }
      } catch (e) {
        logger.error('删除文件失败', e);
      }
    }

    await db!.delete(works).where(eq(works.id, id));

    return NextResponse.json({ requestId: reqId(), success: true, message: '删除成功' });

  } catch (error) {
    logger.error('删除失败', error);
    return internalError(error, '删除失败');
  }
}
