/**
 * GET /api/tasks/[id]/stream
 *
 * W2·SSE 流式任务进度推送（替代轮询）。
 * 通过 Redis pub/sub 订阅任务状态变更，立即推送 status/progress/output/error 事件。
 *
 * 心跳:每 15s 发送 SSE comment 保活。
 * 自动结束:任务进入 completed/failed/cancelled/destroyed 即关闭流。
 */
import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { generationService } from '@/lib/ai/application/generation-service';
import { getRedis } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }
  const { id: taskId } = await params;
  if (!taskId) return new Response('Missing taskId', { status: 400 });

  // 1) 立即查询一次当前快照
  const cur = await generationService.query(user.userId, taskId, { requestId: 'sse-init' });
  if (!cur.found) return new Response('Not found', { status: 404 });
  if (!cur.owned) return new Response('Forbidden', { status: 403 });

  const channel = `task:${taskId}`;
  const redis = getRedis();
  const sub = redis.duplicate();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      // 首次快照
      send('snapshot', cur.task);
      if (cur.task?.status === 'completed' || cur.task?.status === 'failed' || cur.task?.status === 'cancelled') {
        controller.close();
        return;
      }
      // 订阅
      await sub.subscribe(channel);
      sub.on('message', (_ch, raw) => {
        try {
          const payload = JSON.parse(raw);
          const status = payload?.status;
          send('progress', payload);
          if (status === 'completed' || status === 'failed' || status === 'cancelled') {
            controller.close();
          }
        } catch {
          // ignore non-JSON
        }
      });
      // 心跳（防 web server / proxy 断连）
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // 已经关闭
          clearInterval(heartbeat);
        }
      }, 15_000);
      // 关闭钩子
      const cleanup = async () => {
        clearInterval(heartbeat);
        try {
          await sub.unsubscribe(channel);
          await sub.quit();
        } catch {
          /* ignore */
        }
      };
      request.signal.addEventListener('abort', () => {
        void cleanup();
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
