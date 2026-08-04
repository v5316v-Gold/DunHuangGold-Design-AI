/**
 * ComfyUI Prompt API
 * 接收前端 prompt，发送到 ComfyUI 执行
 */

import { NextRequest, NextResponse } from 'next/server';
import { queuePrompt, waitForCompletion, getComfyUISystemInfo } from '@/lib/comfyui-service';
import { requireAuth } from '@/lib/auth';
import { unauthorized } from '@/lib/api-response';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

export const runtime = 'nodejs';

/**
 * POST /api/comfyui/prompt
 * 提交 prompt 到 ComfyUI 执行
 * 
 * Body: {
 *   workflow: object,  // 工作流JSON
 *   prompt: string,   // 用户输入的prompt
 *   wait?: boolean    // 是否等待执行完成
 * }
 */
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) return unauthorized();

  try {
    const { workflow, prompt, wait = true } = await request.json();

    if (!workflow || !prompt) {
      return NextResponse.json(
        {  success: false, error: '缺少必要参数: workflow 和 prompt' },
        { status: 400 }
      );
    }

    console.log('[ComfyUI] 收到请求:', { prompt: prompt.substring(0, 50), hasWorkflow: !!workflow });

    // 提交到 ComfyUI
    const result = await queuePrompt(workflow, prompt);

    if (!result.success) {
      return NextResponse.json(
        {  success: false, error: result.error },
        { status: 500 }
      );
    }

    console.log('[ComfyUI] 已提交, prompt_id:', result.prompt_id);

    // 如果需要等待执行完成
    if (wait) {
      console.log('[ComfyUI] 等待执行完成...');
      const completion = await waitForCompletion(result.prompt_id!);

      if (!completion.completed) {
        return NextResponse.json({
          requestId: reqId(), success: false,
          error: completion.error || '执行超时',
          prompt_id: result.prompt_id,
        });
      }

      console.log('[ComfyUI] 执行完成, 图片数:', completion.images?.length);

      return NextResponse.json({
        requestId: reqId(), success: true,
        prompt_id: result.prompt_id,
        images: completion.images,
      });
    }

    // 立即返回 prompt_id
    return NextResponse.json({
      requestId: reqId(), success: true,
      prompt_id: result.prompt_id,
    });

  } catch (error) {
    console.error('[ComfyUI] 请求处理失败:', error);
    return NextResponse.json(
      {  success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/comfyui/prompt
 * 获取 ComfyUI 系统状态
 */
export async function GET() {
  try {
    const stats = await getComfyUISystemInfo();
    
    if (!stats || !stats.success) {
      return NextResponse.json(
        {  success: false, error: '无法连接到 ComfyUI' },
        { status: 503 }
      );
    }

    return NextResponse.json({
      requestId: reqId(), success: true,
      stats: {
        comfyui_version: stats.stats?.system?.comfyui_version,
        ram_total: stats.stats?.memory?.ram_total,
        ram_free: stats.stats?.memory?.ram_free,
      }
    });
  } catch {
    return NextResponse.json(
      {  success: false, error: '获取状态失败' },
      { status: 500 }
    );
  }
}
