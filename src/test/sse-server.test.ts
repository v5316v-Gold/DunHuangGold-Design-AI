/**
 * sse-server.ts 助手单元测试
 * 验证：心跳、整体超时、produce 抛错、headers
 */
import { describe, it, expect, vi } from 'vitest';
import { createSseResponse } from '@/lib/sse-server';

describe('createSseResponse', () => {
  it('基本流式：3 个数据帧 + done', async () => {
    const res = createSseResponse({
      produce: (enqueue) => {
        enqueue(JSON.stringify({ content: 'a' }));
        enqueue(JSON.stringify({ content: 'b' }));
        enqueue(JSON.stringify({ content: 'c' }));
      },
    });
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    expect(res.headers.get('X-Accel-Buffering')).toBe('no');
    expect(res.headers.get('Cache-Control')).toContain('no-cache');
    const text = await res.text();
    expect(text).toContain('data: {"content":"a"}');
    expect(text).toContain('data: {"content":"b"}');
    expect(text).toContain('data: {"content":"c"}');
  });

  it('心跳：缩短 heartbeatMs 后流中应出现 :keep-alive 注释行', async () => {
    // 用 30ms heartbeat, 慢 produce 触发至少 1 次心跳
    const res = createSseResponse({
      heartbeatMs: 30,
      maxDurationMs: 2000,
      produce: async (enqueue) => {
        enqueue(JSON.stringify({ content: 'start' }));
        await new Promise((r) => setTimeout(r, 120)); // 让 3-4 次心跳通过
        enqueue(JSON.stringify({ content: 'end' }));
      },
    });
    const text = await res.text();
    expect(text).toContain(':keep-alive\n\n');
    // heartbeat 至少出现 1 次
    const heartbeats = (text.match(/:keep-alive\n\n/g) ?? []).length;
    expect(heartbeats).toBeGreaterThanOrEqual(1);
  });

  it('整体超时：maxDurationMs=200, 慢 produce 应在 ~200ms 关闭', async () => {
    const t0 = Date.now();
    const res = createSseResponse({
      heartbeatMs: 1000,
      maxDurationMs: 200,
      produce: async (enqueue) => {
        enqueue(JSON.stringify({ content: 'a' }));
        await new Promise((r) => setTimeout(r, 5000)); // 故意超过 200ms
        enqueue(JSON.stringify({ content: 'b' })); // 不应到达
      },
    });
    await res.text();
    const dt = Date.now() - t0;
    expect(dt).toBeLessThan(500); // < 200ms 超时 + 少量误差
  });

  it('produce 抛错：流中应出现 error 帧', async () => {
    const res = createSseResponse({
      produce: (enqueue) => {
        enqueue(JSON.stringify({ content: 'before-err' }));
        throw new Error('upstream blew up');
      },
    });
    const text = await res.text();
    expect(text).toContain('data: {"content":"before-err"}');
    expect(text).toContain('"error":"upstream blew up"');
    expect(text).toContain('"done":true');
  });
});
