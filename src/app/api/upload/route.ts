import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { BASE_URL, FILE_TYPE_DIRS, getFileTypeDir, type FileType } from '@/lib/storage-config';
import { createLogger } from '@/lib/error-handler';
import { requireAuth } from '@/lib/auth';
import { unauthorized, badRequest, internalError } from '@/lib/api-response';
import { rateLimit, getClientIP, WRITE_LIMIT, rateLimitResponse } from '@/lib/rate-limit';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

const logger = createLogger('upload');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 允许的文件类型目录
const validTypes = new Set(Object.values(FILE_TYPE_DIRS));

async function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  // Rate Limit：同一 IP 5分钟最多30次上传
  const ip = getClientIP(request);
  const rl = await rateLimit(ip, WRITE_LIMIT);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = (formData.get('type') as FileType) || 'images';

    if (!file) {
      return badRequest('没有文件');
    }

    // 验证文件类型目录
    if (!validTypes.has(type)) {
      return badRequest('不支持的文件类型');
    }

    // 验证文件类型（MIME）
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return badRequest('不支持的文件类型');
    }

    // 限制文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return badRequest('文件太大');
    }

    const targetDir = getFileTypeDir(type);
    await ensureDir(targetDir);

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${timestamp}-${randomStr}.${ext}`;
    const filepath = path.join(targetDir, filename);

    // 写入文件
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // 返回访问 URL（使用下载 API）
    const url = `${BASE_URL}/api/download?type=${type}&filename=${filename}`;

    logger.info('文件上传成功', { type, filename, size: file.size });

    return NextResponse.json({
      requestId: reqId(), success: true,
      url,
      filename,
      size: file.size,
      type: file.type,
    });

  } catch (error) {
    logger.error('上传失败', error);
    return internalError(error, '上传失败');
  }
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    // 列出上传的文件
    const imagesDir = getFileTypeDir('images');
    const generatedDir = getFileTypeDir('generated');

    return NextResponse.json({
      requestId: reqId(), success: true,
      paths: {
        images: existsSync(imagesDir) ? `/uploads/images/` : null,
        generated: existsSync(generatedDir) ? `/uploads/generated/` : null,
      },
    });

  } catch (error) {
    logger.error('获取上传目录失败', error);
    return NextResponse.json({ requestId: reqId(), success: false, error: '获取失败' }, { status: 500 });
  }
}
