/**
 * SSE 进度端点
 * 
 * 前端连接此端点获取 ComfyUI 任务执行进度。
 * 端点持续推送进度 JSON，直到任务完成或超时。
 * 
 * GET /api/comfyui/progress?prompt_id=xxx
 * 
 * 推送数据格式：
 *   { type: 'progress', progress: 45 }
 *   { type: 'status', status: 'running', node: 'KSampler' }
 *   { type: 'done', images: ['/api/comfyui-image?...'], error?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// Phase 3.6：统一 requestId 注入（envelope 可追踪性）
function reqId(): string {
  return `req_${randomUUID()}`;
}

const COMFYUI_HOST = process.env.COMFYUI_HOST || 'http://localhost:8188';
const POLL_INTERVAL_MS = 500;
const MAX_POLL_COUNT = 600; // 最多轮询5分钟 (600 * 500ms)

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const promptId = searchParams.get('prompt_id');

  if (!promptId) {
    return NextResponse.json({ requestId: reqId(), error: '缺少 prompt_id 参数' }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let pollCount = 0;
      let lastNodeName = '';

      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // 立即发送初始状态
      send({ type: 'status', status: 'starting', prompt_id: promptId });

      const poll = async (): Promise<void> => {
        pollCount++;

        try {
          // 获取执行历史（包含进度信息）
          const historyRes = await fetch(`${COMFYUI_HOST}/api/history/${promptId}`, {
            signal: AbortSignal.timeout(5000),
          });

          if (!historyRes.ok) {
            if (pollCount < MAX_POLL_COUNT) {
              setTimeout(poll, POLL_INTERVAL_MS);
            } else {
              send({ type: 'done', error: '轮询超时' });
              controller.close();
            }
            return;
          }

          const history = await historyRes.json();
          const promptData = history[promptId];

          if (!promptData) {
            // 任务还没开始，继续等待
            if (pollCount < MAX_POLL_COUNT) {
              send({ type: 'progress', progress: Math.min(pollCount * 2, 95), status: 'queued' });
              setTimeout(poll, POLL_INTERVAL_MS);
            } else {
              send({ type: 'done', error: '未找到执行记录' });
              controller.close();
            }
            return;
          }

          const status = promptData.status;
          const executionTime = status.completed_at
            ? (status.completed_at - status.started_at) / 1000
            : null;

          if (status.errored) {
            send({ type: 'done', error: 'ComfyUI 执行出错' });
            controller.close();
            return;
          }

          if (status.done) {
            // 任务完成，收集输出图片
            const outputs: string[] = [];
            const outputNodes = promptData.outputs || {};

            for (const nodeOutput of Object.values(outputNodes)) {
              const output = nodeOutput as Record<string, unknown>;
              if (output.images && Array.isArray(output.images)) {
                for (const img of output.images) {
                  if (typeof img === 'string') {
                    const match = img.match(/filename=([^;]+)/);
                    const subfolderMatch = img.match(/subfolder=([^;]*)/);
                    const filename = match ? match[1] : img;
                    const subfolder = subfolderMatch ? subfolderMatch[1] : '';
                    outputs.push(`/api/comfyui-image?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}`);
                  } else if (img && typeof img === 'object') {
                    const typed = img as { filename?: string; subfolder?: string };
                    const filename = typed.filename || '';
                    const subfolder = typed.subfolder || '';
                    if (filename) {
                      outputs.push(`/api/comfyui-image?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}`);
                    }
                  }
                }
              }
            }

            send({ type: 'done', images: outputs, executionTime });
            controller.close();
            return;
          }

          // 仍在执行中，推送进度
          // ComfyUI 的 progress 字段范围是 0-10000 (百分比 * 100)
          const comfyProgress = status.progress || 0;
          const percent = Math.round((comfyProgress / 10000) * 100);

          // 获取当前执行的节点名称（如果有）
          const currentNode = (promptData as Record<string, unknown>).current_node as string | undefined;

          send({
            type: 'progress',
            progress: Math.min(percent, 99),
            status: 'running',
            node: currentNode || lastNodeName,
            prompt_id: promptId,
          });

          if (currentNode) lastNodeName = currentNode;

          if (pollCount < MAX_POLL_COUNT) {
            setTimeout(poll, POLL_INTERVAL_MS);
          } else {
            send({ type: 'done', error: '执行超时' });
            controller.close();
          }
        } catch {  // 网络错误等，继续尝试
          // 网络错误等，继续尝试
          if (pollCount < MAX_POLL_COUNT) {
            send({ type: 'progress', progress: Math.min(pollCount * 2, 95), status: 'error_retrying' });
            setTimeout(poll, POLL_INTERVAL_MS);
          } else {
            send({ type: 'done', error: '连接 ComfyUI 失败' });
            controller.close();
          }
        }
      };

      await poll();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
    },
  });
}
