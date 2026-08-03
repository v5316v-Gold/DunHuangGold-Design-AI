import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/error-handler';
import { requireAuth } from '@/lib/auth';
import { unauthorized, badRequest, forbidden, notFound, internalError } from '@/lib/api-response';
import * as fs from 'fs';
import * as path from 'path';

const logger = createLogger('comfyui-image');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ComfyUI 输出目录
const COMFYUI_OUTPUT_PATH = 'E:\\ComfyUI\\ComFyUI-aki-v3\\ComfyUI\\output';

/**
 * 直接从 ComfyUI output 目录获取图片
 * 绕过 /view 接口的 404 问题
 */
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get('filename');
    const subfolder = searchParams.get('subfolder');

    if (!filename) {
      return badRequest('缺少 filename 参数');
    }

    // 构建文件路径
    let filePath: string;
    if (subfolder) {
      filePath = path.join(COMFYUI_OUTPUT_PATH, subfolder, filename);
    } else if (filename.includes('/')) {
      // 如果 filename 中包含路径分隔符，直接使用
      filePath = path.join(COMFYUI_OUTPUT_PATH, filename);
    } else {
      // 如果没有子文件夹，在 output 根目录查找
      filePath = path.join(COMFYUI_OUTPUT_PATH, filename);
    }

    // 安全检查：确保路径在 output 目录内
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(COMFYUI_OUTPUT_PATH))) {
      return forbidden('非法路径');
    }

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      logger.error(`[comfyui-image] 文件不存在: ${filePath}`);
      return notFound('文件不存在');
    }

    // 读取文件
    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    // 根据扩展名确定内容类型
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    
    const contentType = contentTypes[ext] || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    logger.error('[comfyui-image] 错误:', error);
    return internalError(error, '获取图片失败');
  }
}
