import { useState, useCallback, useRef, useEffect } from 'react';
import { callApi } from '@/lib/api-service';
import { useGenerationTask } from './useGenerationTaskManager';

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

        // 检测异步模式响应（ComfyUI 返回 prompt_id + sse_url）
        // async 模式时 prompt_id/sse_url 在 response.data 中
        const respData = (response as { data?: Record<string, unknown> }).data;
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
