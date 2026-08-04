/**
 * 佩戴效果 (Try-On Effect) API
 *
 * 端点: POST /api/tryon
 * 用途: 接收参考图 + 描述,调用 AI 网关 (云端 minimax / 本地 comfyui) 生成佩戴效果图
 *
 * 修复说明 (2026-08-03):
 *   - 此前 src/components/workspace/TryOnEffect.tsx + Sidebar/WorkspacePanel 已挂载,
 *     算力配置也有 (tryon: 25),但缺少实际的 API 路由,导致前端调用必 404。
 *   - 本路由补齐闭环,接受 multipart/json body,使用 src/lib/feature-costs 的算力值。
 *   - 当前实现是占位骨架(返回 taskId + pending),后续可接入 ai-gateway 真实调用。
 *
 * 鉴权: 复用 src/lib/auth.getCurrentUser (Cookie `auth_token` 或 Authorization Bearer)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getFeatureCost } from '@/lib/feature-costs';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TryOnRequest {
  /** 参考图 URL 或 base64 dataURL,数量 1-16 */
  referenceImages?: string[];
  /** 文字描述 (款式/材质/模特等) */
  description?: string;
  /** 模式: closeup=近景特写, model=模特佩戴 */
  mode?: 'closeup' | 'model';
  /** 宽高比:auto / horizontal / vertical / 2k-square / 2k-horizontal */
  aspectRatio?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. 鉴权
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({requestId: reqId(),  success: false, error: '未登录' }, { status: 401 });
    }

    // 2. 解析 body
    let body: TryOnRequest = {};
    try {
      body = (await request.json()) as TryOnRequest;
    } catch {
      return NextResponse.json({requestId: reqId(),  success: false, error: '请求体 JSON 解析失败' }, { status: 400 });
    }

    const images = body.referenceImages || [];
    if (images.length === 0) {
      return NextResponse.json(
        {requestId: reqId(),  success: false, error: '请至少上传一张参考图片' },
        { status: 400 }
      );
    }
    if (images.length > 16) {
      return NextResponse.json({requestId: reqId(),  success: false, error: '参考图片最多 16 张' }, { status: 400 });
    }

    const cost = getFeatureCost('tryon');

    // 3. 占位返回:真实 AI 网关调用待接入 (TODO: forward to ai-gateway)
    //    这里返回 taskId + pending,前端轮询 /api/tasks/[id] 拿结果。
    const taskId = crypto.randomUUID();

    return NextResponse.json({requestId: reqId(), 
      success: true,
      data: {
        taskId,
        status: 'pending',
        cost,
        mode: body.mode || 'model',
        aspectRatio: body.aspectRatio || 'auto',
        userId: payload.userId,
        // 真实接入后,这里会返回 { images: [...url] }
        // 目前先返回占位数据,前端可借此判断路由是否通畅
        message: '佩戴效果任务已创建,AI 网关接入待补 (TODO)',
      },
    });
  } catch (error) {
    console.error('[tryon] 处理失败:', error);
    return NextResponse.json(
      {requestId: reqId(), 
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {requestId: reqId(), 
      success: false,
      error: '请使用 POST 方法调用 /api/tryon',
      hint: '参考 src/components/workspace/TryOnEffect.tsx',
    },
    { status: 405 }
  );
}
