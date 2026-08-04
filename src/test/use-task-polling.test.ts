/**
 * Phase 7.2 · useTaskPolling Hook 单测
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/use-task-polling.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTaskPolling } from '@/hooks/useTaskPolling';

describe('useTaskPolling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始状态 idle', () => {
    const { result } = renderHook(() => useTaskPolling());
    expect(result.current.status).toBe('idle');
    expect(result.current.taskId).toBeNull();
  });

  it('submit 成功 → pending + taskId', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          success: true,
          data: { taskId: 'task-abc', status: 'pending' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useTaskPolling());
    const r = await act(() => result.current.submit({ service: 'text2img', prompt: 'x' }));
    expect(r.ok).toBe(true);
    expect(r.taskId).toBe('task-abc');
    expect(result.current.status).toBe('pending');
  });

  it('submit 失败 → error + 错误信息', async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ success: false, error: { code: 'INSUFFICIENT_POWER', message: '算力不足' } }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useTaskPolling());
    const r = await act(() => result.current.submit({ service: 'text2img' }));
    expect(r.ok).toBe(false);
    expect(result.current.status).toBe('error');
    expect(result.current.error).toContain('算力不足');
  });

  it('refresh 更新任务状态', async () => {
    // submit 返回 pending；refresh 返回 processing
    const submitState = { success: true, data: { taskId: 't1', status: 'pending' } };
    const refreshState = { success: true, data: { id: 't1', status: 'processing', progress: 50 } };
    let call = 0;
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify(call++ === 0 ? submitState : refreshState), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ) as unknown as typeof fetch;

    const { result } = renderHook(() => useTaskPolling({ intervalMs: 1000 }));
    // 手动提交
    await act(async () => {
      const r = await result.current.submit({ service: 'text2img', prompt: 'y' });
      expect(r.ok).toBe(true);
    });
    await act(async () => {
      await result.current.refresh('t1');
    });
    expect(result.current.status).toBe('processing');
    expect(result.current.progress).toBe(50);
  });

  it('reset 恢复 idle', async () => {
    const { result } = renderHook(() => useTaskPolling());
    await act(() => result.current.reset());
    expect(result.current.status).toBe('idle');
  });
});
