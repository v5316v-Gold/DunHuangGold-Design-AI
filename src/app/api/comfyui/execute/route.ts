/**
 * ComfyUI 工作流执行 API
 * POST /api/comfyui/execute
 * 
 * 请求体:
 * {
 *   workflowId: string,        // 工作流ID (如 image-generate)
 *   prompt: string,            // 用户输入的 prompt
 *   inputImage?: string,       // 可选：输入图片URL
 *   params?: object            // 其他参数
 * }
 * 
 * 返回:
 * {
 *   success: boolean,
 *   prompt_id?: string,
 *   images?: string[],
 *   error?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/db';
import { workflows } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

/* eslint-disable @typescript-eslint/no-explicit-any */


// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}
export const dynamic = 'force-dynamic';

const COMFYUI_HOST = 'http://localhost:8188';

interface ComfyUIResponse {
  success: boolean;
  prompt_id?: string;
  error?: string;
  images?: string[];
}

interface PromptRequest {
  workflowId: string;
  prompt: string;
  inputImage?: string;
  params?: Record<string, any>;
}

/**
 * 提交工作流到 ComfyUI 执行
 */
async function queuePrompt(workflowJson: any, promptText: string, host: string = COMFYUI_HOST): Promise<ComfyUIResponse> {
  try {
    // 修改工作流中的文本节点
    const modifiedWorkflow = injectPrompt(workflowJson, promptText);

    const response = await fetch(`${host}/api/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: modifiedWorkflow,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `ComfyUI API错误: ${response.status} - ${error}` };
    }

    const data = await response.json();
    return {
      success: true,
      prompt_id: data.prompt_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '提交工作流失败',
    };
  }
}

/**
 * 获取执行历史
 */
async function getHistory(promptId: string, host: string = COMFYUI_HOST): Promise<any> {
  try {
    const response = await fetch(`${host}/api/history/${promptId}`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * 获取执行结果图片
 */
async function getOutputImages(promptId: string, host: string = COMFYUI_HOST): Promise<string[]> {
  const history = await getHistory(promptId, host);
  if (!history || !history[promptId]) {
    return [];
  }

  const outputs = history[promptId].outputs || {};
  const images: string[] = [];

  // 遍历所有输出节点
  for (const nodeId of Object.keys(outputs)) {
    const nodeOutput = outputs[nodeId];

    // 处理图片输出
    if (nodeOutput.images) {
      for (const img of nodeOutput.images) {
        const imageUrl = `${host}/view?filename=${img.filename}&type=output`;
        images.push(imageUrl);
      }
    }

    // 处理 GIF 输出
    if (nodeOutput.gifs) {
      for (const gif of nodeOutput.gifs) {
        const gifUrl = `${host}/view?filename=${gif.filename}&type=output`;
        images.push(gifUrl);
      }
    }
  }

  return images;
}

/**
 * 注入 prompt 文本到工作流
 */
function injectPrompt(workflow: any, promptText: string): any {
  if (!workflow || !workflow.nodes) {
    return workflow;
  }

  const modified = { ...workflow, nodes: { ...workflow.nodes } };

  // 遍历所有节点，找到文本输入类型的节点
  for (const [nodeId, node] of Object.entries<any>(workflow.nodes)) {
    if (node.class_type === 'CLIPTextEncode' ||
      node.class_type === 'Text Prompt' ||
      node.class_type === 'Prompt' ||
      node.class_type?.includes('Text')) {
      // 注入到 positive 或 text 字段
      if (node.inputs) {
        if (node.inputs.positive) {
          modified.nodes[nodeId] = {
            ...node,
            inputs: {
              ...node.inputs,
              positive: promptText,
            }
          };
        } else if (node.inputs.text) {
          modified.nodes[nodeId] = {
            ...node,
            inputs: {
              ...node.inputs,
              text: promptText,
            }
          };
        }
      }
    }
  }

  return modified;
}

/**
 * 轮询等待执行完成
 */
async function waitForCompletion(
  promptId: string,
  host: string = COMFYUI_HOST,
  maxWaitMs: number = 300000,
  intervalMs: number = 2000
): Promise<{ completed: boolean; images?: string[]; error?: string }> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const history = await getHistory(promptId, host);

    if (history && history[promptId]) {
      const status = history[promptId].status;

      if (status?.err) {
        return { completed: true, error: '执行失败' };
      }

      if (status?.completed) {
        const images = await getOutputImages(promptId, host);
        return { completed: true, images };
      }
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return { completed: false, error: '执行超时' };
}

/**
 * POST /api/comfyui/execute
 * 执行工作流
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await getCurrentUser(request);
    if (!payload) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '请先登录' }, { status: 401 });
    }

    const body: PromptRequest = await request.json();
    const { workflowId, prompt, inputImage, params } = body;

    if (!workflowId || !prompt) {
      return NextResponse.json({ requestId: reqId(), success: false, error: '缺少必要参数' }, { status: 400 });
    }

    // 获取工作流配置
    let workflowConfig = null;
    let comfyuiHost = COMFYUI_HOST;

    if (db) {
      const result = await db.select().from(workflows).where(eq(workflows.id, workflowId));
      if (result.length > 0) {
        workflowConfig = result[0];
        comfyuiHost = workflowConfig.comfyuiHost || COMFYUI_HOST;
      }
    }

    // 如果没有配置工作流，返回错误
    if (!workflowConfig || !workflowConfig.workflowJson || Object.keys(workflowConfig.workflowJson).length === 0) {
      return NextResponse.json({
        requestId: reqId(), success: false,
        error: `工作流 ${workflowId} 未配置，请先在管理后台添加工作流`
      }, { status: 400 });
    }

    // 提交工作流执行
    const submitResult = await queuePrompt(workflowConfig.workflowJson, prompt, comfyuiHost);

    if (!submitResult.success || !submitResult.prompt_id) {
      return NextResponse.json(submitResult);
    }

    // 更新执行计数
    if (db && workflowConfig) {
      await db.update(workflows)
        .set({
          lastExecuted: new Date(),
          executionCount: (workflowConfig.executionCount || 0) + 1,
        })
        .where(eq(workflows.id, workflowId));
    }

    // 等待执行完成
    const result = await waitForCompletion(submitResult.prompt_id, comfyuiHost);

    return NextResponse.json({
      requestId: reqId(), success: result.completed,
      prompt_id: submitResult.prompt_id,
      images: result.images,
      error: result.error,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '执行工作流失败';
    return NextResponse.json({ requestId: reqId(), success: false, error: errorMessage }, { status: 500 });
  }
}

/**
 * GET /api/comfyui/execute
 * 测试 ComfyUI 连接状态
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const host = searchParams.get('host') || COMFYUI_HOST;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${host}/system_stats`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({
        requestId: reqId(), online: false,
        error: `连接失败: ${response.status}`
      });
    }

    const stats = await response.json();

    return NextResponse.json({
      requestId: reqId(), online: true,
      version: stats.system?.comfyui_version,
      gpu: stats.devices?.[0]?.name,
    });
  } catch (error) {
    return NextResponse.json({
      requestId: reqId(), online: false,
      error: error instanceof Error ? error.message : '连接失败'
    });
  }
}
