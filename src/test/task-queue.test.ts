/**
 * P1 · TaskQueue 单测（Redis/BullMQ 全 mock，覆盖幂等与重复分支）
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/task-queue.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted：mock 工厂在模块加载时即执行，需用 hoisted 声明共享对象（避免 TDZ）
const { redisMock, queueAdd } = vi.hoisted(() => ({
  redisMock: {
    getRedis: vi.fn(),
    getBullConnection: vi.fn(),
  },
  queueAdd: vi.fn(),
}));

// 全 mock redis 模块（避免真实连接）
vi.mock('@/lib/redis', () => redisMock);

// mock bullmq：Queue 实例化 + add
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: queueAdd,
    getJobCounts: vi.fn(async () => ({ waiting: 3, active: 2, completed: 10, failed: 1, delayed: 0 })),
    getJob: vi.fn(async () => ({ id: 'job-1' })),
    close: vi.fn(async () => undefined),
  })),
}));

import {
  checkIdempotency,
  releaseIdempotency,
  enqueueTask,
  getQueueStats,
  getJobByTaskId,
  closeTaskQueue,
} from '@/lib/queue/task-queue';

describe('task-queue · 幂等与入队（P1）', () => {
  const payload = {
    taskId: 'task-1',
    userId: 'u1',
    serviceType: 'text2img',
    params: { prompt: 'test' },
    idempotencyKey: 'k1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.getRedis.mockReturnValue({
      set: vi.fn(async () => 'OK'),
      del: vi.fn(async () => 1),
    });
    queueAdd.mockReset();
    queueAdd.mockResolvedValue({ id: 'job-1' });
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('checkIdempotency 首次提交 → true（SETNX=OK）', async () => {
    const r = await checkIdempotency('k1');
    expect(r).toBe(true);
    const setFn = redisMock.getRedis().set;
    expect(setFn).toHaveBeenCalledWith('idem:k1', '1', 'EX', 3600, 'NX');
  });

  it('checkIdempotency 重复提交 → false（SETNX=null）', async () => {
    redisMock.getRedis.mockReturnValue({ set: vi.fn(async () => null) });
    const r = await checkIdempotency('k1');
    expect(r).toBe(false);
  });

  it('releaseIdempotency 删除幂等键', async () => {
    await releaseIdempotency('k1');
    expect(redisMock.getRedis().del).toHaveBeenCalledWith('idem:k1');
  });

  it('enqueueTask 首次 → 入队成功 duplicate=false', async () => {
    const r = await enqueueTask(payload);
    expect(r.duplicate).toBe(false);
    expect(r.taskId).toBe('task-1');
    expect(queueAdd).toHaveBeenCalledWith('text2img', payload, { jobId: 'task-1' });
  });

  it('enqueueTask 幂等命中 → duplicate=true 不入队', async () => {
    redisMock.getRedis.mockReturnValue({ set: vi.fn(async () => null) });
    const r = await enqueueTask(payload);
    expect(r.duplicate).toBe(true);
    expect(queueAdd).not.toHaveBeenCalled();
  });

  it('getQueueStats 汇总各计数', async () => {
    const s = await getQueueStats();
    expect(s).toEqual({ waiting: 3, active: 2, completed: 10, failed: 1, delayed: 0 });
  });

  it('getJobByTaskId 返回 job', async () => {
    const j = await getJobByTaskId('task-1');
    expect(j?.id).toBe('job-1');
  });

  it('closeTaskQueue 幂等（未初始化不抛错）', async () => {
    await expect(closeTaskQueue()).resolves.toBeUndefined();
  });
});
