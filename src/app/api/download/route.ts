import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { readFileSync, statSync } from 'fs';
import path from 'path';
import { UPLOAD_DIR, FILE_TYPE_DIRS } from '@/lib/storage-config';
import { requireAuth } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 允许的文件类型目录
const validTypes = new Set(Object.values(FILE_TYPE_DIRS));

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const filename = searchParams.get('filename');

    if (!type || !filename) {
      return NextResponse.json({ success: false, error: '缺少参数' }, { status: 400 });
    }

    // 安全检查：防止路径遍历攻击
    if (!validTypes.has(type as any)) {
      return NextResponse.json({ success: false, error: '无效的文件类型' }, { status: 400 });
    }

    if (filename.includes('..') || type.includes('..')) {
      return NextResponse.json({ success: false, error: '无效的文件路径' }, { status: 400 });
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

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Content-Length': String(stat.size),
        'Cache-Control': 'public, max-age=31536000',
      },
    });

  } catch (error) {
    console.error('[download] 错误:', error);
    return NextResponse.json({ success: false, error: '获取文件失败' }, { status: 500 });
  }
}
