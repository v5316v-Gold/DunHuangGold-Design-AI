/**
 * Phase 5.2 · TaskRepository（任务数据访问抽象）
 *
 * ADR-014（Repository 抽象）+ 5.6（自动重连）
 *
 * 职责：tasks 表统一读写入口。
 * - DB 连接失败自动重试（指数退避）
 * - DB 不可用降级内存态（memory-task-store）
 * - 上层（GenerationService / Worker）只依赖本 Repository，不直接触碰 drizzle
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { tasks } from '@/db/schema/_tables';
import { withRetry } from './db-retry';
import { getMemoryTaskState, updateMemoryTask } from '@/lib/queue/memory-task-store';

export interface TaskRow {
  id: string;
  userId: string;
  type: string;
  status: string;
  progress: number;
  error: string | null;
  output: Record<string, unknown> | null;
  powerCost: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  featureCode?: string | null;
}

export class TaskRepository {
  /** 创建任务（返回任务 id） */
  async create(input: {
    userId: string;
    type: string;
    status?: string;
    params: Record<string, unknown>;
    powerCost?: number;
    featureCode?: string;
  }): Promise<string> {
    if (db) {
      try {
        const [row] = await withRetry(() =>
          (db as NonNullable<typeof db>)
            .insert(tasks)
            .values({
              userId: input.userId,
              type: input.type,
              featureCode: input.featureCode ?? input.type,
              status: input.status ?? 'pending',
              input: input.params,
              powerCost: input.powerCost ?? 0,
            })
            .returning()
        );
        if (row?.id) return row.id;
      } catch {
        // 落到内存降级
      }
    }
    // 内存降级（本地开发/测试/DB 故障）
    const { randomUUID } = await import('crypto');
    const id = randomUUID();
    updateMemoryTask(id, { status: input.status ?? 'pending' });
    return id;
  }

  /** 按 id 查询 */
  async findById(taskId: string): Promise<TaskRow | null> {
    if (db) {
      try {
        const rows = await withRetry(() =>
          (db as NonNullable<typeof db>).select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
        );
        const row = rows[0];
        if (row) {
          return {
            id: row.id,
            userId: row.userId,
            type: row.type,
            status: row.status ?? 'pending',
            progress: row.progress ?? 0,
            error: row.error,
            output: (row.output as Record<string, unknown>) ?? null,
            powerCost: row.powerCost ?? 0,
            startedAt: row.startedAt,
            completedAt: row.completedAt,
            createdAt: row.createdAt,
            featureCode: row.featureCode,
          };
        }
      } catch {
        // 走内存
      }
    }
    const mem = getMemoryTaskState(taskId);
    if (!mem) return null;
    return {
      id: mem.id,
      userId: mem.userId,
      type: mem.type,
      status: mem.status,
      progress: mem.progress,
      error: mem.error,
      output: mem.output,
      powerCost: mem.powerCost,
      startedAt: mem.startedAt ? new Date(mem.startedAt) : null,
      completedAt: mem.completedAt ? new Date(mem.completedAt) : null,
      createdAt: new Date(mem.createdAt),
    };
  }

  /** 更新状态/进度/错误 */
  async update(
    taskId: string,
    patch: {
      status?: string;
      progress?: number;
      error?: string | null;
      output?: Record<string, unknown> | null;
      startedAt?: Date | null;
      completedAt?: Date | null;
    }
  ): Promise<void> {
    if (db) {
      try {
        const setFields: Record<string, unknown> = {};
        if (patch.status !== undefined) setFields.status = patch.status;
        if (patch.progress !== undefined) setFields.progress = patch.progress;
        if (patch.error !== undefined) setFields.error = patch.error;
        if (patch.output !== undefined) setFields.output = patch.output;
        if (patch.startedAt !== undefined) setFields.startedAt = patch.startedAt;
        if (patch.completedAt !== undefined) setFields.completedAt = patch.completedAt;
        if (Object.keys(setFields).length === 0) return;
        await withRetry(() =>
          (db as NonNullable<typeof db>).update(tasks).set(setFields).where(eq(tasks.id, taskId))
        );
        return;
      } catch {
        // 走内存
      }
    }
    updateMemoryTask(taskId, {
      status: patch.status as never,
      progress: patch.progress,
      error: patch.error as never,
      output: patch.output as never,
      startedAt: patch.startedAt?.toISOString() as never,
      completedAt: patch.completedAt?.toISOString() as never,
    });
  }
}

export const taskRepository = new TaskRepository();
