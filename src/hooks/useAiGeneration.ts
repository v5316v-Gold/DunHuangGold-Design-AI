import { useState, useCallback, useRef, useEffect } from 'react';
import { callApi } from '@/lib/api-service';
import { getAuthHeader } from '@/lib/auth-client';
import { useGenerationTask } from './useGenerationTaskManager';

/* eslint-disable @typescript-eslint/no-explicit-any */


// ==================== SSE 进度连接器 ====================

interface SSEProgressOptions {
  onProgress: (progress: number) => void;
  onError: (error: string) => void;
  onDone: (images: string[]) => void;
  signal: AbortSignal;
}

/**
 * 连接 SSE 进度端点，实时接收 ComfyUI 任务进度
 */
async function connectSSEProgress(
  sseUrl: string,
  options: SSEProgressOptions
): Promise<void> {
  const { onProgress, onError, onDone, signal } = options;

  try {
    const response = await fetch(sseUrl, { signal });

    if (!response.ok) {
      throw new Error(`SSE 连接失败: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('SSE 响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6).trim();
          if (!dataStr || dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr) as {
              type: string;
              progress?: number;
              error?: string;
              images?: string[];
            };

            switch (data.type) {
              case 'progress':
                if (data.progress !== undefined) {
                  onProgress(data.progress);
                }
                break;
              case 'done':
                if (data.error) {
                  onError(data.error);
                } else if (data.images?.length) {
                  onDone(data.images);
                } else {
                  onError('生成完成但未返回图片');
                }
                return;
              case 'status':
                // 初始状态，可忽略
                break;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      onError('请求已取消');
    } else {
      onError((err as Error).message || 'SSE 连接失败');
    }
  }
}

/**
 * W2·尝试通过 EventSource 订阅 /api/tasks/[id]/stream。
 * 返回 true = SSE 已完整推送完成事件（success/failed/cancelled），false = 中途断流或被取消，回退轮询。
 */
async function tryTaskSse(
  taskId: string,
  options: {
    onProgress: (p: number) => void;
    onError: (msg: string) => void;
    onDone: (taskData: Record<string, unknown>) => void;
    signal: AbortSignal;
  }
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (typeof window === 'undefined') return resolve(false);
    const url = `/api/tasks/${encodeURIComponent(taskId)}/stream`;
    let es: EventSource | null = null;
    let resolved = false;
    const done = (ok: boolean) => {
      if (resolved) return;
      resolved = true;
      if (es) es.close();
      resolve(ok);
    };
    try {
      es = new EventSource(url, { withCredentials: true } as EventSourceInit & { withCredentials?: boolean });
      es.addEventListener('snapshot', (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data) as { status?: string; progress?: number };
          if (typeof data.progress === 'number') options.onProgress(data.progress);
        } catch { /* ignore */ }
      });
      es.addEventListener('progress', (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data) as { status?: string; progress?: number; error?: string; output?: Record<string, unknown> };
          if (typeof data.progress === 'number') options.onProgress(data.progress);
          if (data.status === 'completed') {
            options.onDone(data as unknown as Record<string, unknown>);
            done(true);
          } else if (data.status === 'failed' || data.status === 'dead_letter') {
            options.onError(String(data.error || '任务失败'));
            done(true);
          } else if (data.status === 'cancelled') {
            options.onError('任务已取消');
            done(true);
          }
        } catch { /* ignore */ }
      });
      es.onerror = () => {
        // SSE 中断 → 回退轮询，不视为失败
        done(false);
      };
      options.signal.addEventListener('abort', () => done(false));
    } catch {
      done(false);
    }
    // 兜底:5s 内没收到 snapshot 也视为不可用,回退轮询
    setTimeout(() => {
      if (!resolved) done(false);
    }, 5_000);
  });
}

interface UseAiGenerationOptions {
  featureId: string;
  cost: number;
  power: number;
  onDeductPower: (amount: number, reason: string) => void;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  /** 是否启用全局任务状态（跨页面保持，默认 true） */
  persistent?: boolean;
}

interface UseAiGenerationReturn {
  isGenerating: boolean;
  progress: number;
  error: string | null;
  generate: (params: Record<string, any>, deductReason: string) => Promise<any>;
  reset: () => void;
  setError: (error: string | null) => void;
  setProgress: (progress: number) => void;
}

/**
 * AI 生成任务统一 Hook
 * 
 * 功能：
 * - 统一的算力检查
 * - 统一的进度管理
 * - 统一的错误处理
 * - 支持请求取消
 * - 自动扣除算力
 * 
 * @example
 * ```tsx
 * const { isGenerating, progress, error, generate } = useAiGeneration({
 *   featureId: 'text2img',
 *   cost: 15,
 *   power,
 *   onDeductPower,
 *   onSuccess: (data) => setResult(data),
 * });
 * 
 * const handleGenerate = async () => {
 *   const result = await generate({ prompt, resolution: '2k' }, '文案生图');
 * };
 * ```
 */
export function useAiGeneration({
  featureId,
  cost,
  power,
  onDeductPower,
  onSuccess,
  onError,
}: UseAiGenerationOptions): UseAiGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const taskIdRef = useRef<string | null>(null);

  // 全局任务管理器
  const taskManager = useGenerationTask();
  const { startTask, updateTask, completeTask, failTask, currentTask } = taskManager;

  // 同步全局任务状态到本地
  useEffect(() => {
    if (currentTask && currentTask.featureId === featureId) {
      // Defer to avoid cascading renders - this is intentional state sync with global task
      const timer = setTimeout(() => {
        setIsGenerating(currentTask.status === 'generating');
        setProgress(currentTask.progress);
        setError(currentTask.error || null);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [currentTask, featureId]);

  const reset = useCallback(() => {
    setIsGenerating(false);
    setProgress(0);
    setError(null);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const generate = useCallback(
    async (params: Record<string, any>, deductReason: string) => {
      // 算力检查
      if (power < cost) {
        const errorMsg = `算力不足！当前：${power}，需要：${cost}`;
        setError(errorMsg);
        onError?.(errorMsg);
        return null;
      }

      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setIsGenerating(true);
      setError(null);
      setProgress(0);

      // 启动全局任务
      const newTaskId = startTask({
        featureId,
        taskId: '',
        result: undefined,
        params,
        deductReason,
      });
      taskIdRef.current = newTaskId;

      // 启动进度动画（真实进度由 API 回调更新）
      progressIntervalRef.current = setInterval(() => {
        setProgress((p) => {
          // 进度不超过 90%，等待 API 完成
          if (p >= 90) return p;
          return Math.min(p + Math.random() * 10, 90);
        });
      }, 300);

      try {
        // 先提交任务（同步模式或异步模式）
        const response = await callApi<any>(featureId, {
          params,
          onProgress: (p) => {
            setProgress(p);
            if (taskIdRef.current) {
              updateTask(taskIdRef.current, { progress: p });
            }
          },
          signal: abortControllerRef.current!.signal,
        });

        // 清除 fake 进度动画
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }

        // Phase 9.26 · async 任务模式 (/api/ai/generate-async 返回 taskId + statusUrl)
        //        优先采用 W2 SSE 流(/api/tasks/[id]/stream),失败回退到 2s 轮询
        const respData = (response as { data?: Record<string, unknown> }).data;
        if (response.success && respData?.taskId) {
          const taskId = String(respData.taskId);
          const statusUrl = String(respData.statusUrl || `/api/tasks/${taskId}`);
          const POLL_INTERVAL = 2000;
          const MAX_POLLS = 300; // 10 分钟上限

          if (taskIdRef.current) {
            updateTask(taskIdRef.current, { taskId });
          }

          // W2 · 优先尝试 SSE 流（断流自动回退轮询，不阻塞 UI）
          const sseHandled = await tryTaskSse(taskId, {
            onProgress: (p) => {
              setProgress(p);
              if (taskIdRef.current) updateTask(taskIdRef.current, { progress: p });
            },
            onError: (msg) => {
              setError(msg);
              onError?.(msg);
            },
            onDone: (taskData) => {
              setProgress(100);
              onDeductPower(cost, deductReason);
              if (taskIdRef.current) completeTask(taskIdRef.current, taskData);
              const output = (taskData?.output as Record<string, any>) ?? {};
              const artifacts = Array.isArray(output.artifacts) ? output.artifacts : [];
              const images = artifacts.map(a => a?.url).filter(Boolean) as string[];
              const result = {
                images,
                imageUrl: (output.imageUrl as string) ?? images[0] ?? null,
                modelUrl: (output.modelUrl as string) ?? artifacts.find(a => String(a?.mime || '').includes('glb') || String(a?.url || '').includes('.glb'))?.url ?? null,
                videoUrl: (output.videoUrl as string) ?? null,
                raw: taskData,
              };
              onSuccess?.(result);
            },
            signal: abortControllerRef.current!.signal,
          });
          if (sseHandled) {
            // SSE 已完成（成功 / 失败 / cancel），不再轮询
            return null;
          }

          for (let i = 0; i < MAX_POLLS; i++) {
            if (abortControllerRef.current?.signal.aborted) {
              throw new Error('请求已取消');
            }
            await new Promise((r) => setTimeout(r, POLL_INTERVAL));
            try {
              const pollRes = await fetch(statusUrl, {
                headers: { ...getAuthHeader() },
                signal: abortControllerRef.current!.signal,
              });
              if (!pollRes.ok) {
                if (pollRes.status >= 500) continue; // 5xx 重试
                throw new Error(`轮询任务失败: HTTP ${pollRes.status}`);
              }
              const pollJson = await pollRes.json();
              const taskData = pollJson?.data ?? pollJson;
              const status = String(taskData?.status ?? '');
              const progress = Number(taskData?.progress ?? 0);
              if (Number.isFinite(progress) && progress > 0) {
                setProgress(progress);
                if (taskIdRef.current) updateTask(taskIdRef.current, { progress });
              }
              if (status === 'completed') {
                setProgress(100);
                onDeductPower(cost, deductReason);
                if (taskIdRef.current) completeTask(taskIdRef.current, taskData);
                // 归一化结果契约：不要直接把整个 taskData 交给面板，
                // 而是解包 worker 写入的 output，得到 images/imageUrl/modelUrl/videoUrl
                const output = (taskData?.output as Record<string, any>) ?? {};
                const artifacts = Array.isArray(output.artifacts) ? output.artifacts : [];
                const images = artifacts.map(a => a?.url).filter(Boolean) as string[];
                const result = {
                  images,
                  imageUrl: (output.imageUrl as string) ?? images[0] ?? null,
                  modelUrl: (output.modelUrl as string) ?? artifacts.find(a => String(a?.mime || '').includes('glb') || String(a?.url || '').includes('.glb'))?.url ?? null,
                  videoUrl: (output.videoUrl as string) ?? null,
                  raw: taskData,
                };
                onSuccess?.(result);
                return result;
              }
              if (status === 'failed' || status === 'dead_letter') {
                const errMsg = String(taskData?.error ?? '任务失败');
                throw new Error(errMsg);
              }
              // pending / processing 继续轮询
            } catch (pollErr) {
              if ((pollErr as Error).name === 'AbortError') throw pollErr;
              if (i > 5) throw pollErr; // 前 5 次容错
            }
          }
          throw new Error('任务超时(10分钟未完成)');
        }

        // ComfyUI 老异步模式（prompt_id + sse_url 兼容）
        if (response.success && respData?.prompt_id && respData?.sse_url) {
          const sse_url = respData.sse_url as string;

          // 通过 SSE 轮询真实进度
          await connectSSEProgress(sse_url, {
            onProgress: (p: number) => {
              setProgress(p);
              if (taskIdRef.current) updateTask(taskIdRef.current, { progress: p });
            },
            onError: (errMsg: string) => {
              setError(errMsg);
              onError?.(errMsg);
              if (taskIdRef.current) failTask(taskIdRef.current, errMsg);
              setIsGenerating(false);
              taskIdRef.current = null;
            },
            onDone: (images: string[]) => {
              setProgress(100);
              onDeductPower(cost, deductReason);
              if (taskIdRef.current) completeTask(taskIdRef.current, images);
              onSuccess?.(images);
              setIsGenerating(false);
              taskIdRef.current = null;
            },
            signal: abortControllerRef.current!.signal,
          });
          return null; // 结果通过 onSuccess 回调返回
        }

        // 同步模式（原有行为）
        if (response.success && response.data) {
          setProgress(100);
          onDeductPower(cost, deductReason);
          if (taskIdRef.current) completeTask(taskIdRef.current, response.data);
          onSuccess?.(response.data);
          return response.data;
        } else {
          throw new Error(response.error || '生成失败');
        }
      } catch (err: unknown) {
        // 清除进度定时器
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }

        // 忽略取消的请求
        if ((err as Error).name === 'AbortError') {
          return null;
        }

        const errorMsg = (err as Error).message || '生成失败，请重试';
        setError(errorMsg);
        onError?.(errorMsg);
        // 标记全局任务失败
        if (taskIdRef.current) {
          failTask(taskIdRef.current, errorMsg);
        }
        setProgress(0);
        return null;
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
        taskIdRef.current = null;
      }
    },
    [featureId, cost, power, onDeductPower, onSuccess, onError]
  );

  return {
    isGenerating,
    progress,
    error,
    generate,
    reset,
    setError,
    setProgress,
  };
}
