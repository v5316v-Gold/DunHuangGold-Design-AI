/**
 * SSE（Server-Sent Events）服务端助手
 *
 * 解决两个长对话痛点：
 *  1. nginx / 反代默认 60s 空闲超时切断 — 用 ":keep-alive\\n\\n" 注释行每 15s 发一次
 *     （SSE 规范允许注释行，浏览器忽略）
 *  2. AI 进程挂死或网络断开无反馈 — AbortSignal.timeout 120s 整体超时主动关流
 *
 * 用法：
 *   return createSseResponse({
 *     heartbeatMs: 15_000,
 *     maxDurationMs: 120_000,
 *     produce: (enqueue, signal) => chatStream(enqueue, signal),
 *   });
 *
 * produce 回调：enqueue 写入 "data: {...}\\n\\n" 字符串；signal 超时或客户端断开时触发
 */

export interface SseServerOptions {
  /** 心跳间隔（ms），默认 15000。注释行格式 ":keep-alive\\n\\n" */
  heartbeatMs?: number;
  /** 整体超时（ms），默认 120000。超时后 controller.close() */
  maxDurationMs?: number;
  /** 客户端响应头附加（如 'X-Accel-Buffering': 'no' 禁止 nginx 缓冲） */
  headers?: Record<string, string>;
  /** 生产回调：enqueue 写入 data 字符串，signal 在超时/断开时触发 */
  produce: (
    enqueue: (data: string) => void,
    signal: AbortSignal
  ) => Promise<void> | void;
}

const HEARTBEAT = ':keep-alive\n\n';

export function createSseResponse(opts: SseServerOptions): Response {
  const heartbeatMs = opts.heartbeatMs ?? 15_000;
  const maxDurationMs = opts.maxDurationMs ?? 120_000;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 整体超时（abort）
      const timer = setTimeout(() => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'timeout', done: true })}\n\n`));
        } catch { /* already closed */ }
        controller.close();
      }, maxDurationMs);
      // 心跳
      const hb = setInterval(() => {
        try { controller.enqueue(encoder.encode(HEARTBEAT)); } catch { /* closed */ }
      }, heartbeatMs);
      try {
        await opts.produce(
          (data) => controller.enqueue(encoder.encode(`data: ${data}\n\n`)),
          AbortSignal.timeout(maxDurationMs)
        );
      } catch (error) {
        // produce 抛错时（如上游 API 失败）发 error 帧
        try {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ error: (error as Error).message, done: true })}\n\n`
          ));
        } catch { /* closed */ }
      } finally {
        clearTimeout(timer);
        clearInterval(hb);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',  // 禁止 nginx 缓冲
      ...(opts.headers ?? {}),
    },
  });
}
