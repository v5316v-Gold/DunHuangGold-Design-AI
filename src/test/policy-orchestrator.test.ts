/**
 * Phase 4 · 编排策略 + PolicyOrchestrator 单测
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/policy-orchestrator.test.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { decideRouting } from '@/lib/ai/orchestration/routing-policy';
import { shouldRetry, bullmqRetryOptions } from '@/lib/ai/orchestration/retry-policy';
import { decideFallback, fullExecutionChain, allAttempted } from '@/lib/ai/orchestration/fallback-policy';
import {
  createExecutionPlan,
  createExecutionTrace,
} from '@/lib/ai/domain/execution-plan';
import { canTransition } from '@/lib/queue/task-state';
import { PolicyOrchestrator } from '@/lib/ai/orchestration/policy-orchestrator';
import type { Executor } from '@/lib/ai/ports/executor.port';

describe('routing-policy · 路由决策', () => {
  it('无配置 → 默认链 third-party/comfyui/mock', () => {
    const r = decideRouting('text2img');
    expect(r.executorId).toBe('third-party');
    expect(r.fallbackChain).toEqual(['comfyui', 'mock']);
  });

  it('DB 配置优先（defaultExecutor）', () => {
    const r = decideRouting('text2img', {
      defaultExecutor: 'comfyui',
      fallbackExecutors: ['mock'],
    });
    expect(r.executorId).toBe('comfyui');
    expect(r.fallbackChain).toEqual(['mock']);
  });

  it('非法 executor 名被过滤', () => {
    const r = decideRouting('text2img', {
      defaultExecutor: 'invalid-executor',
      fallbackExecutors: ['comfyui', 'bogus'],
    });
    // defaultExecutor 非法 → 回退默认
    expect(r.executorId).toBe('third-party');
    expect(r.fallbackChain).toContain('comfyui');
  });
});

describe('retry-policy · 重试决策', () => {
  it('参数错误不可重试', () => {
    const r = shouldRetry('INVALID_INPUT', 0);
    expect(r.verdict).toBe('no_retry');
  });

  it('超限 → dead_letter', () => {
    const r = shouldRetry('PROVIDER_UNAVAILABLE', 3, { maxRetries: 3 });
    expect(r.verdict).toBe('dead_letter');
  });

  it('可重试错误 → retry + 指数退避', () => {
    const r = shouldRetry('PROVIDER_UNAVAILABLE', 1, { maxRetries: 3, baseDelayMs: 1000 });
    expect(r.verdict).toBe('retry');
    expect(r.backoffMs).toBe(2000); // 1000 * 2^1
  });

  it('BullMQ options 对齐', () => {
    const o = bullmqRetryOptions({ maxRetries: 3, baseDelayMs: 5000 });
    expect(o.attempts).toBe(4);
    expect(o.backoff.type).toBe('exponential');
  });
});

describe('fallback-policy · 兜底决策', () => {
  const plan = createExecutionPlan({
    taskId: 't1',
    featureId: 'text2img',
    userId: 'u1',
    executorId: 'third-party',
    fallbackChain: ['comfyui', 'mock'],
    estimatedCost: 10,
    inputsSnapshot: {},
  });

  it('主执行器失败 → 第一个兜底', () => {
    const trace = createExecutionTrace(plan);
    trace.attempted.push({ executorId: 'third-party', success: false, at: new Date().toISOString() });
    const fb = decideFallback(plan, trace);
    expect(fb.nextExecutor).toBe('comfyui');
    expect(fb.exhausted).toBe(false);
  });

  it('全部尝试 → exhausted', () => {
    const trace = createExecutionTrace(plan);
    for (const id of fullExecutionChain(plan)) {
      trace.attempted.push({ executorId: id, success: false, at: new Date().toISOString() });
    }
    const fb = decideFallback(plan, trace);
    expect(fb.exhausted).toBe(true);
    expect(allAttempted(plan, trace)).toBe(true);
  });
});

describe('task-state · 状态机强制', () => {
  it('合法流转', () => {
    expect(canTransition('queued', 'pending')).toBe(true);
    expect(canTransition('pending', 'processing')).toBe(true);
    expect(canTransition('processing', 'completed')).toBe(true);
    expect(canTransition('failed', 'pending')).toBe(true);
    expect(canTransition('dead_letter', 'pending')).toBe(true);
  });

  it('非法流转被拒绝', () => {
    expect(canTransition('completed', 'processing')).toBe(false);
    expect(canTransition('cancelled', 'pending')).toBe(false);
    expect(canTransition('queued', 'completed')).toBe(false);
  });
});

describe('PolicyOrchestrator · 策略驱动执行', () => {
  beforeEach(() => vi.clearAllMocks());

  function makeExecutor(id: 'third-party' | 'comfyui' | 'mock', opts: { fail?: boolean; retryable?: boolean; supports?: string[] } = {}) {
    const ex: Executor = {
      id,
      productionSafe: id !== 'mock',
      capabilities: () => new Set(opts.supports ?? ['text2img']),
      execute: vi.fn(async () => {
        if (opts.fail) {
          return {
            success: false,
            error: { code: 'PROVIDER_UNAVAILABLE', message: 'provider down', retryable: opts.retryable ?? true },
            executorUsed: id,
            cost: 0,
            latencyMs: 1,
            traceId: 'trace-1',
          };
        }
        return {
          success: true,
          executorUsed: id,
          provider: id,
          artifacts: [{ url: 'https://x/a.png', mime: 'image/png' }],
          cost: 10,
          latencyMs: 1,
          traceId: 'trace-1',
        };
      }),
    };
    return ex;
  }

  it('主执行器成功 → 返回结果 + audit', async () => {
    const orch = new PolicyOrchestrator({ production: false });
    orch.register(makeExecutor('third-party'));
    const r = await orch.execute({ featureId: 'text2img', userId: 'u1', inputs: {} });
    expect(r.success).toBe(true);
    expect(r.executorUsed).toBe('third-party');
  });

  it('主失败 → 兜底链执行', async () => {
    const orch = new PolicyOrchestrator({ production: false });
    orch.register(makeExecutor('third-party', { fail: true }));
    orch.register(makeExecutor('comfyui'));
    const r = await orch.execute({ featureId: 'text2img', userId: 'u1', inputs: {} });
    expect(r.success).toBe(true);
    expect(r.executorUsed).toBe('comfyui');
  });

  it('全部失败 → ALL_EXECUTORS_FAILED', async () => {
    const orch = new PolicyOrchestrator({ production: false });
    orch.register(makeExecutor('third-party', { fail: true, retryable: false }));
    orch.register(makeExecutor('comfyui', { fail: true, retryable: false }));
    orch.register(makeExecutor('mock', { fail: true, retryable: false }));
    const r = await orch.execute({ featureId: 'text2img', userId: 'u1', inputs: {} });
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('ALL_EXECUTORS_FAILED');
  });

  it('不支持功能的执行器被跳过', async () => {
    const orch = new PolicyOrchestrator({ production: false });
    orch.register(makeExecutor('third-party', { supports: ['relief'] }));
    orch.register(makeExecutor('comfyui'));
    const r = await orch.execute({ featureId: 'text2img', userId: 'u1', inputs: {} });
    expect(r.success).toBe(true);
    expect(r.executorUsed).toBe('comfyui');
  });

  it('功能不存在 → FEATURE_NOT_FOUND', async () => {
    const orch = new PolicyOrchestrator({ production: false });
    orch.register(makeExecutor('third-party'));
    const r = await orch.execute({ featureId: 'nope', userId: 'u1', inputs: {} });
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('FEATURE_NOT_FOUND');
  });
});
