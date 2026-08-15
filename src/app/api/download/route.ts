import { NextRequest, NextResponse } from 'next/server';
import { promises as fsp } from 'fs';
import path from 'path';
import { UPLOAD_DIR, FILE_TYPE_DIRS } from '@/lib/storage-config';
import { requireAuth } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';
import { randomUUID } from 'crypto';

/* eslint-disable @typescript-eslint/no-explicit-any */


// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

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
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少参数' }, { status: 400 });
    }

    // 安全检查：防止路径遍历攻击
    if (!validTypes.has(type as any)) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '无效的文件类型' }, { status: 400 });
    }

    if (filename.includes('..') || type.includes('..')) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '无效的文件路径' }, { status: 400 });
    }

    const filepath = path.join(UPLOAD_DIR, type, filename);

    // 异步读取 + 检查文件
    let buffer: ArrayBuffer;
    let size: number;
    try {
      const buf = await fsp.readFile(filepath);
      buffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      const stat = await fsp.stat(filepath);
      size = stat.size;
    } catch {
      return NextResponse.json({ requestId: reqId(), success: false, error: '文件不存在' }, { status: 404 });
    }

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
        'Content-Length': String(size),
        'Cache-Control': 'public, max-age=31536000',
      },
    });

  } catch (error) {
    console.error('[download] 错误:', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '获取文件失败' }, { status: 500 });
  }
}
