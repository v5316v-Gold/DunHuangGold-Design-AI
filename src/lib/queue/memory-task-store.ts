/**
 * 内存任务存储（DB 不可用时的降级层）
 *
 * Phase 3：generation-service 与 task-state 都依赖本模块，避免循环依赖。
 * 生产环境 DB 正常时不使用；本地开发/测试/DB 故障时提供任务生命周期降级。
 */

export interface MemoryTask {
  id: string;
  userId: string;
  type: string;
  status: string;
  progress: number;
  error: string | null;
  output: Record<string, unknown> | null;
  powerCost: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export const memoryTasks = new Map<string, MemoryTask>();

/** 读取内存任务状态（供 task-state 无 DB 时兜底） */
export function getMemoryTaskState(taskId: string) {
  const t = memoryTasks.get(taskId);
  if (!t) return null;
  return {
    id: t.id,
    userId: t.userId,
    type: t.type,
    status: t.status,
    progress: t.progress,
    error: t.error,
    output: t.output,
    powerCost: t.powerCost,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
  };
}

/** 创建内存任务 */
export function createMemoryTask(input: {
  id: string;
  userId: string;
  type: string;
  status?: string;
  params: Record<string, unknown>;
  powerCost: number;
}): MemoryTask {
  const task: MemoryTask = {
    id: input.id,
    userId: input.userId,
    type: input.type,
    status: input.status ?? 'pending',
    progress: 0,
    error: null,
    output: null,
    powerCost: input.powerCost,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };
  memoryTasks.set(task.id, task);
  return task;
}

/** 更新内存任务状态 */
export function updateMemoryTask(
  taskId: string,
  patch: Partial<Pick<MemoryTask, 'status' | 'progress' | 'error' | 'output' | 'startedAt' | 'completedAt'>>
): void {
  const t = memoryTasks.get(taskId);
  if (!t) return;
  Object.assign(t, patch);
}
