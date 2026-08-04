/**
 * Phase 5 · Repository 层单测
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/repository.test.ts
 */
import { describe, it, expect, vi } from 'vitest';
import { withRetry, isConnectionError } from '@/db/repositories/db-retry';
import { TaskRepository } from '@/db/repositories/task-repository';
import { FeatureRepository } from '@/db/repositories/feature-repository';

describe('db-retry · 自动重连', () => {
  it('连接错误自动重试后成功', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls === 1) {
        const e = new Error('ECONNREFUSED') as Error & { code?: string };
        e.code = 'ECONNREFUSED';
        throw e;
      }
      return 'ok';
    });
    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('业务错误不重试，直接抛出', async () => {
    const fn = vi.fn(async () => {
      const e = new Error('duplicate key') as Error & { code?: string };
      e.code = '23505'; // unique violation
      throw e;
    });
    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 1 })).rejects.toThrow('duplicate key');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('持续连接错误 → 达到上限后抛出', async () => {
    const fn = vi.fn(async () => {
      const e = new Error('ECONNREFUSED') as Error & { code?: string };
      e.code = 'ECONNREFUSED';
      throw e;
    });
    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow('ECONNREFUSED');
    expect(fn).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it('isConnectionError 判定', () => {
    const e1 = new Error('x') as Error & { code?: string };
    e1.code = '57P01';
    expect(isConnectionError(e1)).toBe(true);
    const e2 = new Error('connection refused');
    expect(isConnectionError(e2)).toBe(true);
    const e3 = new Error('normal failure');
    expect(isConnectionError(e3)).toBe(false);
  });
});

describe('TaskRepository · 内存降级', () => {
  it('DB 不可用时 create 返回内存 id', async () => {
    const repo = new TaskRepository();
    // DB null 环境下（无 DATABASE_URL 的测试进程）应走内存
    const id = await repo.create({
      userId: 'u1',
      type: 'text2img',
      params: { prompt: 'hello' },
      powerCost: 15,
    });
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('DB 不可用时 findById 返回 null（无内存记录）', async () => {
    const repo = new TaskRepository();
    const row = await repo.findById('no-such-id');
    // 内存无记录 → null（或 DB null → null）
    expect(row).toBeNull();
  });
});

describe('FeatureRepository · 静态兜底', () => {
  it('DB 不可用时返回静态定义', async () => {
    const repo = new FeatureRepository();
    const feature = await repo.findById('text2img');
    expect(feature).not.toBeNull();
    expect(feature?.id).toBe('text2img');
    expect(feature?.enabled).toBe(true);
  });

  it('listEnabled 返回全部静态功能（DB 不可用）', async () => {
    const repo = new FeatureRepository();
    const list = await repo.listEnabled();
    expect(list.length).toBeGreaterThanOrEqual(10);
  });
});
