/**
 * ComfyUI 执行 API
 * POST /api/comfyui/call
 * 
 * 根据数据库配置执行 ComfyUI 工作流
 * 
 * 请求体:
 * {
 *   featureId: string,        // 功能ID (text2img, refine, etc.)
 *   prompt?: string,          // 正向提示词
 *   negativePrompt?: string,  // 负向提示词
 *   inputImage?: string,     // 输入图片URL
 *   width?: number,
 *   height?: number,
 *   steps?: number,
 *   cfg?: number,
 *   seed?: number,
 *   count?: number,
 *   model?: string,
 *   [其他参数...]
 * }
 * 
 * 返回:
 * {
 *   success: boolean,
 *   source: 'local' | 'cloud',
 *   images?: string[],
 *   error?: string,
 *   promptId?: string,
 *   workflowId?: string,
 *   executionTimeMs?: number,
 *   usedConnection?: { id, name, host }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { callComfyUI, checkComfyUIHealth } from '@/lib/comfyui-call-service';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('comfyui-call');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/comfyui/call
 * 执行 ComfyUI 工作流
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 验证登录 (可选，公开接口可以跳过)
    // const payload = await getCurrentUser(request);
    // if (!payload) {
    //   return NextResponse.json({ success: false, error: '请先登录' }, { status: 401 });
    // }

    // 2. 解析请求
    const body = await request.json();
    const { 
      featureId,
      prompt,
      negativePrompt,
      inputImage,
      width,
      height,
      steps,
      cfg,
      seed,
      count,
      model,
      ...extraParams
    } = body;

    if (!featureId) {
      return NextResponse.json(
        { success: false, error: '缺少 featureId 参数' },
        { status: 400 }
      );
    }

    logger.info(`执行 ComfyUI 工作流`, { featureId, prompt: prompt?.substring(0, 50) });

    // 3. 调用执行
    const result = await callComfyUI({
      featureId,
      prompt,
      negativePrompt,
      inputImage,
      width,
      height,
      steps,
      cfg,
      seed,
      count,
      model,
      ...extraParams,
    });

    // 4. 返回结果
    return NextResponse.json({
      success: result.success,
      source: result.source,
      images: result.images,
      error: result.error,
      promptId: result.promptId,
      workflowId: result.workflowId,
      executionTimeMs: result.executionTimeMs,
      usedConnection: result.usedConnection,
    });

  } catch (error) {
    logger.error('ComfyUI 执行失败', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '执行失败' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/comfyui/call
 * 检查 ComfyUI 状态
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId') || undefined;

    const result = await checkComfyUIHealth(connectionId);

    return NextResponse.json({
      online: result.online,
      connection: result.connection ? {
        id: result.connection.id,
        name: result.connection.name,
        host: `${result.connection.host}:${result.connection.port}`,
      } : null,
      version: result.version,
      gpu: result.gpu,
      error: result.error,
    });

  } catch (error) {
    return NextResponse.json(
      { online: false, error: error instanceof Error ? error.message : '检查失败' },
      { status: 500 }
    );
  }
}
