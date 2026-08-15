import { apiClient, API_ROUTES } from '@/lib/api-client';
/**
 * Phase 7.2 · useTaskPolling — 统一任务轮询 Hook
 *
 * 供所有 AI 功能组件复用：提交异步任务 → 轮询 /api/tasks/[id] → 状态/进度/结果。
 *
 * 用法：
 *   const { submit, task, status, progress, error, output, reset } = useTaskPolling();
 *   await submit({ service: 'text2img', prompt });
 *
 * 与 GenerationService.query 对齐：返回 envelope { success, data: {...} }。
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type TaskPollStatus =
  | 'idle'
  | 'submitting'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'dead_letter'
  | 'error';

export interface TaskPollState {
  status: TaskPollStatus;
  taskId: string | null;
  progress: number;
  error: string | null;
  output: Record<string, unknown> | null;
  message: string | null;
}

const IDLE: TaskPollState = {
  status: 'idle',
  taskId: null,
  progress: 0,
  error: null,
  output: null,
  message: null,
};

const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = 600; // 15 分钟上限

export function useTaskPolling(opts: { intervalMs?: number } = {}) {
  const intervalMs = opts.intervalMs ?? POLL_INTERVAL_MS;
  const [state, setState] = useState<TaskPollState>(IDLE);
  const pollCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  /** 提交异步任务 */
  const submit = useCallback(
    async (body: Record<string, unknown>): Promise<{ ok: boolean; taskId?: string; error?: string }> => {
      stopPolling();
      pollCountRef.current = 0;
      setState((s) => ({ ...s, status: 'submitting', message: '正在提交任务...' }));

      try {
        const json = await apiClient.post<{ taskId?: string }>(API_ROUTES.generateAsync, body);

        if (!json.success) {
          const code = json.code;
          const message = json.error ?? '任务提交失败';
          setState((s) => ({ ...s, status: 'error', error: message }));
          return { ok: false, error: message };
        }

        const taskId = json.data?.taskId;
        setState((s) => ({ ...s, status: 'pending', taskId: taskId ?? null, message: '任务已提交' }));
        return { ok: true, taskId };
      } catch (e) {
        const message = e instanceof Error ? e.message : '网络错误';
        setState((s) => ({ ...s, status: 'error', error: message }));
        return { ok: false, error: message };
      }
    },
    [stopPolling]
  );

  /** 主动查询一次 */
  const refresh = useCallback(async (taskId?: string) => {
    const id = taskId ?? state.taskId;
    if (!id) return;
    try {
      const res = await fetch(`/api/tasks/${id}`);
      const json = await res.json().catch(() => null);
      if (!json?.success) {
        const code = json?.error?.code;
        setState((s) => ({
          ...s,
          status: code === 'TASK_NOT_FOUND' ? 'error' : s.status,
          error: json?.error?.message ?? '查询失败',
        }));
        return;
      }
      const d = json.data ?? {};
      setState((s) => ({
        ...s,
        status: (d.status ?? s.status) as TaskPollStatus,
        progress: d.progress ?? s.progress,
        error: d.error ?? s.error,
        output: d.output ?? s.output,
      }));
    } catch {
      // 轮询失败静默（下次重试）
    }
  }, [state.taskId]);

  /** 开始轮询（submit 成功后自动调用） */
  const startPolling = useCallback(
    (taskId: string) => {
      stopPolling();
      pollCountRef.current = 0;
      timerRef.current = setInterval(async () => {
        pollCountRef.current += 1;
        if (pollCountRef.current > MAX_POLLS) {
          stopPolling();
          setState((s) => ({ ...s, status: 'error', error: '轮询超时' }));
          return;
        }
        await refresh(taskId);
      }, intervalMs);
    },
    [intervalMs, refresh, stopPolling]
  );

  /** 提交并轮询（一步到位） */
  const submitAndPoll = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await submit(body);
      if (r.ok && r.taskId) startPolling(r.taskId);
      return r;
    },
    [submit, startPolling]
  );

  const reset = useCallback(() => {
    stopPolling();
    setState(IDLE);
  }, [stopPolling]);

  return { ...state, submit, submitAndPoll, refresh, startPolling, reset };
}
