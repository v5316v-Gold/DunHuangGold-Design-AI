/**
 * 生成任务全局状态管理器
 * 
 * 问题：页面切换时组件卸载，导致 useState 状态丢失，生成任务中断
 * 解决：使用 sessionStorage + 自定义事件，实现跨页面任务状态保持
 * 
 * 使用方式：
 * 1. 在 _app.tsx 或 layout 中引入 GenerationTaskProvider
 * 2. 组件中使用 useGenerationTask 来获取/更新任务状态
 */

'use client';

import React, { createContext, useContext, useEffect, useCallback, useState, useRef } from 'react';

// ==================== 类型定义 ====================

export interface GenerationTask {
  featureId: string;           // 功能ID，如 'image-3d'
  taskId: string;              // 任务ID
  status: 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled';
  progress: number;             // 0-100
  result?: unknown;            // 生成结果
  error?: string;              // 错误信息
  params?: Record<string, unknown>; // 生成参数
  startTime: number;           // 开始时间戳
  endTime?: number;            // 结束时间戳
  deductReason?: string;       // 扣费原因
}

interface GenerationTaskContextValue {
  tasks: Map<string, GenerationTask>;
  activeTask: GenerationTask | null;
  startTask: (task: Omit<GenerationTask, 'status' | 'progress' | 'startTime'>) => string;
  updateTask: (taskId: string, updates: Partial<GenerationTask>) => void;
  completeTask: (taskId: string, result: any) => void;
  failTask: (taskId: string, error: string) => void;
  cancelTask: (taskId: string) => void;
  getTask: (taskId: string) => GenerationTask | undefined;
  getTaskByFeature: (featureId: string) => GenerationTask | undefined;
  clearTask: (taskId: string) => void;
  clearAllTasks: () => void;
}

// ==================== 常量 ====================

const STORAGE_KEY = 'generation-tasks-v2';
const TASK_EVENT_NAME = 'generation-task-update';

// ==================== 存储工具 ====================

function loadTasksFromStorage(): Map<string, GenerationTask> {
  if (typeof window === 'undefined') return new Map();
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      const arr = JSON.parse(saved);
      return new Map(arr);
    }
  } catch (_) {}
  return new Map();
}

function saveTasksToStorage(tasks: Map<string, GenerationTask>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...tasks]));
  } catch (_) {}
}

// ==================== 上下文 ====================

const GenerationTaskContext = createContext<GenerationTaskContextValue | null>(null);

// ==================== Provider ====================

export function GenerationTaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Map<string, GenerationTask>>(() => new Map());
  const isInitialized = useRef(false);

  // 从 storage 恢复状态
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    
    const saved = loadTasksFromStorage();
    // 过滤掉已完成超过 30 分钟的任务
    const now = Date.now();
    const validTasks = new Map(
      [...saved].filter(([_, task]) => {
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          return task.endTime && (now - task.endTime) < 30 * 60 * 1000;
        }
        return true;
      })
    );
    setTasks(validTasks);
  }, []);

  // 状态变化时保存到 storage
  useEffect(() => {
    if (!isInitialized.current) return;
    saveTasksToStorage(tasks);
    
    // 广播事件通知其他组件
    window.dispatchEvent(new CustomEvent(TASK_EVENT_NAME, { detail: { tasks } }));
  }, [tasks]);

  // 监听其他标签页/组件的状态更新
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ tasks: Map<string, GenerationTask> }>;
      setTasks(customEvent.detail.tasks);
    };
    window.addEventListener(TASK_EVENT_NAME, handler);
    return () => window.removeEventListener(TASK_EVENT_NAME, handler);
  }, []);

  const startTask = useCallback((task: Omit<GenerationTask, 'status' | 'progress' | 'startTime'>): string => {
    const taskId = `${task.featureId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newTask: GenerationTask = {
      ...task,
      taskId,
      status: 'generating',
      progress: 0,
      startTime: Date.now(),
    };
    setTasks(prev => new Map(prev).set(taskId, newTask));
    return taskId;
  }, []);

  const updateTask = useCallback((taskId: string, updates: Partial<GenerationTask>) => {
    setTasks(prev => {
      const task = prev.get(taskId);
      if (!task) return prev;
      const newTasks = new Map(prev);
      newTasks.set(taskId, { ...task, ...updates });
      return newTasks;
    });
  }, []);

  const completeTask = useCallback((taskId: string, result: any) => {
    setTasks(prev => {
      const task = prev.get(taskId);
      if (!task) return prev;
      const newTasks = new Map(prev);
      newTasks.set(taskId, {
        ...task,
        status: 'completed',
        result,
        progress: 100,
        endTime: Date.now(),
      });
      return newTasks;
    });
  }, []);

  const failTask = useCallback((taskId: string, error: string) => {
    setTasks(prev => {
      const task = prev.get(taskId);
      if (!task) return prev;
      const newTasks = new Map(prev);
      newTasks.set(taskId, {
        ...task,
        status: 'failed',
        error,
        endTime: Date.now(),
      });
      return newTasks;
    });
  }, []);

  const cancelTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const task = prev.get(taskId);
      if (!task) return prev;
      const newTasks = new Map(prev);
      newTasks.set(taskId, {
        ...task,
        status: 'cancelled',
        endTime: Date.now(),
      });
      return newTasks;
    });
  }, []);

  const getTask = useCallback((taskId: string) => tasks.get(taskId), [tasks]);

  const getTaskByFeature = useCallback((featureId: string) => {
    for (const task of tasks.values()) {
      if (task.featureId === featureId && task.status === 'generating') {
        return task;
      }
    }
    return undefined;
  }, [tasks]);

  const clearTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const newTasks = new Map(prev);
      newTasks.delete(taskId);
      return newTasks;
    });
  }, []);

  const clearAllTasks = useCallback(() => {
    setTasks(new Map());
  }, []);

  // 计算当前活跃任务
  const activeTask = Array.from(tasks.values()).find(
    t => t.status === 'generating'
  ) || null;

  return (
    <GenerationTaskContext.Provider value={{
      tasks,
      activeTask,
      startTask,
      updateTask,
      completeTask,
      failTask,
      cancelTask,
      getTask,
      getTaskByFeature,
      clearTask,
      clearAllTasks,
    }}>
      {children}
    </GenerationTaskContext.Provider>
  );
}

// ==================== Hook ====================

export function useGenerationTask(featureId?: string) {
  const context = useContext(GenerationTaskContext);
  if (!context) {
    throw new Error('useGenerationTask must be used within GenerationTaskProvider');
  }

  // 如果提供了 featureId，返回该功能的当前任务
  const featureTask = featureId ? context.getTaskByFeature(featureId) : context.activeTask;

  return {
    ...context,
    currentTask: featureTask,
    isGenerating: featureTask?.status === 'generating' || false,
    progress: featureTask?.progress || 0,
    result: featureTask?.result,
    error: featureTask?.error,
  };
}

// ==================== 便捷函数 ====================

/**
 * 独立的任务状态监听器（不需要 React Context）
 * 用于在非组件环境中监听任务状态变化
 */
export function addTaskListener(callback: (tasks: Map<string, GenerationTask>) => void): () => void {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent<{ tasks: Map<string, GenerationTask> }>;
    callback(customEvent.detail.tasks);
  };
  window.addEventListener(TASK_EVENT_NAME, handler);
  return () => window.removeEventListener(TASK_EVENT_NAME, handler);
}
