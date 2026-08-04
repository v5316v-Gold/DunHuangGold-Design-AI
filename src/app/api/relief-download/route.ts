import { NextRequest, NextResponse } from 'next/server';
import { unauthorized, internalError } from '@/lib/api-response';
import { createLogger } from '@/lib/error-handler';
import { requireAuth } from '@/lib/auth';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

const logger = createLogger('relief-download');


export const runtime = 'nodejs';

/**
 * 浮雕下载接口
 * 根据不同格式返回不同类型的文件
 *
 * 格式说明：
 * - PNG: 浮雕预览图（普通图片）
 * - EXR: 深度图（高动态范围格式，需要3D渲染支持）
 * - VSM: 特殊格式（用于特定3D软件）
 */
/**
 * @deprecated 此路由已废弃，90 天后将被删除。
 * 功能已合并到新路由，90天后删除
 */
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    const { modelUrl, previewImage, depthMap, downloadFormat = 'png', reliefType } = await request.json();

    if (!previewImage && !modelUrl) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '没有可下载的内容' }, { status: 400 });
    }

    console.log(`[relief-download] 下载浮雕: format=${downloadFormat}, reliefType=${reliefType}`);

    // 根据格式返回不同的下载信息
    if (downloadFormat === 'png') {
      // PNG 格式：返回预览图
      if (!previewImage) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '预览图不存在' }, { status: 400 });
      }
      return NextResponse.json({
        requestId: reqId(), success: true,
        downloadUrl: previewImage,
        filename: `relief-${reliefType}-${Date.now()}.png`,
        mimeType: 'image/png',
        description: '浮雕预览图（PNG格式）',
      });
    } else if (downloadFormat === 'exr') {
      // EXR 格式：返回深度图（如果有）
      if (depthMap) {
        return NextResponse.json({
          requestId: reqId(), success: true,
          downloadUrl: depthMap,
          filename: `relief-${reliefType}-depth-${Date.now()}.exr`,
          mimeType: 'image/x-exr',
          description: '浮雕深度图（EXR高动态范围格式）',
        });
      } else {
        // 如果没有深度图，返回3D模型
        return NextResponse.json({
          requestId: reqId(), success: true,
          downloadUrl: modelUrl,
          filename: `relief-${reliefType}-model-${Date.now()}.glb`,
          mimeType: 'model/gltf-binary',
          description: '浮雕3D模型（GLB格式）',
          warning: 'EXR深度图不可用，已切换为3D模型',
        });
      }
    } else if (downloadFormat === 'vsm') {
      // VSM 格式：返回3D模型
      if (!modelUrl) {
        return NextResponse.json({ requestId: reqId(), success: false, error: '3D模型不存在' }, { status: 400 });
      }
      return NextResponse.json({
        requestId: reqId(), success: true,
        downloadUrl: modelUrl,
        filename: `relief-${reliefType}-model-${Date.now()}.glb`,
        mimeType: 'model/gltf-binary',
        description: '浮雕3D模型（GLB格式，兼容VSM）',
      });
    } else {
      return NextResponse.json({ requestId: reqId(), success: false, error: `不支持的格式: ${downloadFormat}` }, { status: 400 });
    }

  } catch (error) {
    logger.error('[relief-download] 错误:');
    return internalError(error, '下载失败');
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      error: '此路由已废弃，请使用 POST /api/relief',
      deprecated: true,
      migration: 'POST /api/relief with { previewImage, modelUrl, depthMap, downloadFormat }',
    },
    { status: 410, headers: { 'X-Deprecated-Source': 'relief-download' } }
  );
}
