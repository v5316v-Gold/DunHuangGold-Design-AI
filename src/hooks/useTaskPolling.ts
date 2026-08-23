/**
 * useTaskPolling · 异步任务轮询公共 hook
 *
 * 抽取自 Text2Video / Image2Video / Dialog2D3D / ImageWorkspace 四处重复的
 * 60-80 行轮询逻辑：每 2s 拉一次 /api/tasks/{taskId}，completed/failed 即终止。
 *
 * 行为差异由 callback 处理（onCompleted 解析 output、onFailed 处理错误），
 * hook 只负责"等状态 + 报告进度 + 中止"。
 */
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { getAuthHeader } from '@/lib/auth-client';

export type TaskStatusKind =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'dead_letter';

export interface UseTaskPollingOptions {
  /** 状态变化回调（含 completed / failed / progress） */
  onProgress?: (status: TaskStatusKind, taskData: Record<string, unknown>) => void;
  /** 终止信号（用户取消） */
  signal?: AbortSignal;
  /** 轮询间隔 ms，默认 2000 */
  intervalMs?: number;
  /** 最大轮询次数，默认 300（10 分钟） */
  maxAttempts?: number;
}

export interface UseTaskPollingReturn {
  /** 启动轮询；返回 Promise，completed 时 resolve taskData，failed 时 reject Error */
  startPolling: (
    taskId: string,
    overrides?: { onProgress?: UseTaskPollingOptions['onProgress'] }
  ) => Promise<Record<string, unknown>>;
}

/**
 * 轮询 /api/tasks/{taskId} 直到 completed（resolve taskData）
 * 或 failed / dead_letter（reject Error）。支持中途 abort。
 */
export function useTaskPolling(opts: UseTaskPollingOptions = {}): UseTaskPollingReturn {
  // 支持两种调用方式：
  //   startPolling(taskId) - 全局 options
  //   startPolling(taskId, { onProgress }) - 每次调用覆盖 options
  const globalOpts = opts;
  const { onProgress, signal, intervalMs = 2000, maxAttempts = 300 } = globalOpts;
  // 用 ref + useEffect 让回调始终是最新的，避免轮询循环里 capture 旧 closure。
  const onProgressRef = useRef(onProgress);
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);
  // 覆盖用回调 ref（每次 startPolling 调用的 overrides.onProgress）
  const overrideCbRef = useRef<UseTaskPollingOptions['onProgress']>(undefined);
  useEffect(() => {
    overrideCbRef.current = undefined;
  });

  const startPolling = useCallback(
    async (
      taskId: string,
      overrides?: { onProgress?: UseTaskPollingOptions['onProgress'] }
    ): Promise<Record<string, unknown>> => {
      overrideCbRef.current = overrides?.onProgress;
      const statusUrl = `/api/tasks/${taskId}`;
      let consecutiveErrors = 0;

      for (let i = 0; i < maxAttempts; i++) {
        if (signal?.aborted) {
          throw new DOMException('Polling aborted', 'AbortError');
        }
        await new Promise((r) => setTimeout(r, intervalMs));

        try {
          const pollRes = await fetch(statusUrl, { headers: { ...getAuthHeader() } });
          if (!pollRes.ok) {
            if (pollRes.status >= 500 && consecutiveErrors < 5) {
              consecutiveErrors++;
              continue;
            }
            throw new Error(`轮询任务失败: HTTP ${pollRes.status}`);
          }
          consecutiveErrors = 0;

          const pollJson = await pollRes.json();
          const taskData = (pollJson?.data ?? pollJson) as Record<string, unknown>;
          const status = String(taskData?.status ?? '') as TaskStatusKind;
          onProgressRef.current?.(status, taskData);
          overrideCbRef.current?.(status, taskData);

          if (status === 'completed') return taskData;
          if (status === 'failed' || status === 'dead_letter') {
            throw new Error(String(taskData?.error ?? '任务失败'));
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') throw err;
          if (consecutiveErrors >= 5) throw err;
          consecutiveErrors++;
          if (i === maxAttempts - 1) throw err;
        }
      }
      throw new Error('任务轮询超时（10 分钟未完成）');
    },
    [intervalMs, maxAttempts, signal]
  );

  return { startPolling };
}
