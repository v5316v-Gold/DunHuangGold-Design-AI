import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { unauthorized, badRequest, forbidden, internalError } from '@/lib/api-response';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

/**
 * 模型文件代理（解决跨域问题）
 * 将 Meshy CDN 的模型文件代理到同源，避免 model-viewer 的 CORS 限制
 */
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const modelUrl = searchParams.get('url');

  if (!modelUrl) {
    return badRequest('缺少 url 参数');
  }

  // 只允许代理 Meshy 的资源
  if (!modelUrl.includes('assets.meshy.ai') && !modelUrl.includes('meshy.ai')) {
    return forbidden('不允许代理此 URL');
  }

  try {
    console.log('[proxy-model] 代理请求:', modelUrl.substring(0, 80));
    const response = await fetch(modelUrl);

    if (!response.ok) {
      return NextResponse.json(
        {  success: false, error: `模型文件获取失败: ${response.status}` },
        { status: 502 }
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'model/gltf-binary',
        'Content-Length': String(arrayBuffer.byteLength),
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[proxy-model] 代理失败:', error);
    return internalError(error, '代理请求失败');
  }
}
