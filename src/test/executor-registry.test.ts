/**
 * P1 · ExecutorRegistry 注册逻辑单测（ADR-010 生产 mock 守卫）
 *
 * 覆盖：
 *  - 非生产 → mock 被注册
 *  - 生产 + 无灰度 → mock 不注册（ADR-010）
 *  - 生产 + ALLOW_MOCK_IN_PRODUCTION=true → mock 注册（灰度）
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/executor-registry.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const hoisted = vi.hoisted(() => {
  const registeredIds: string[] = [];
  return {
    registeredIds,
    registryMock: {
      register: vi.fn((ex: { id: string }) => {
        registeredIds.push(ex.id);
      }),
    },
  };
});
const { registeredIds } = hoisted;

vi.mock('@/lib/ai/orchestration/policy-orchestrator', () => ({
  policyOrchestrator: hoisted.registryMock,
}));

vi.mock('@/lib/orchestrator/executors/mock-executor', () => ({
  MockExecutor: class MockExecutor { id = 'mock-local'; type = 'mock'; capabilities = () => new Set(); execute = async () => ({ success: false }); },
}));
vi.mock('@/lib/orchestrator/executors/comfyui-executor', () => ({
  ComfyUIExecutor: class ComfyUIExecutor { id = 'comfyui'; type = 'comfyui'; capabilities = () => new Set(); execute = async () => ({ success: false }); },
}));
vi.mock('@/lib/orchestrator/executors/hermes-agent-executor', () => ({
  HermesAgentExecutor: class HermesAgentExecutor { id = 'hermes'; type = 'hermes'; capabilities = () => new Set(); execute = async () => ({ success: false }); },
}));
vi.mock('@/lib/orchestrator/executors/minimax-executor', () => ({
  MinimaxExecutor: class MinimaxExecutor { id = 'minimax'; type = 'minimax'; capabilities = () => new Set(); execute = async () => ({ success: false }); },
}));

describe('ExecutorRegistry · 注册与 ADR-010 mock 守卫（P1）', () => {
  let registerExecutors: () => void;

  beforeEach(() => {
    vi.resetModules();
    registeredIds.length = 0; // 清空跨测试累积（hoisted 实例共享）
    delete process.env.ALLOW_MOCK_IN_PRODUCTION;
  });

  afterEach(() => {
    delete process.env.ALLOW_MOCK_IN_PRODUCTION;
    delete process.env.NODE_ENV;
  });

  it('非生产环境 → 注册 mock + comfyui + hermes + minimax', async () => {
    process.env.NODE_ENV = 'development';
    ({ registerExecutors } = await import('@/lib/ai/adapters/executor-registry'));
    const ids = new Set(registeredIds);
    expect(ids.has('mock')).toBe(true);
    expect(ids.has('comfyui')).toBe(true);
    expect(ids.has('hermes')).toBe(true);
    expect(ids.has('minimax')).toBe(true);
  });

  it('生产环境 + 无灰度开关 → mock 不注册（ADR-010）', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_MOCK_IN_PRODUCTION;
    ({ registerExecutors } = await import('@/lib/ai/adapters/executor-registry'));
    const ids = new Set(registeredIds);
    expect(ids.has('mock')).toBe(false);
    expect(ids.has('comfyui')).toBe(true);
    expect(ids.has('hermes')).toBe(true);
    expect(ids.has('minimax')).toBe(true);
  });

  it('生产环境 + ALLOW_MOCK_IN_PRODUCTION=true → mock 注册（灰度放行）', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_MOCK_IN_PRODUCTION = 'true';
    ({ registerExecutors } = await import('@/lib/ai/adapters/executor-registry'));
    const ids = new Set(registeredIds);
    expect(ids.has('mock')).toBe(true);
    expect(ids.has('comfyui')).toBe(true);
  });

  it('重复调用 registerExecutors 幂等（initialized 守卫）', async () => {
    process.env.NODE_ENV = 'development';
    ({ registerExecutors } = await import('@/lib/ai/adapters/executor-registry'));
    const before = registeredIds.length;
    registerExecutors();
    expect(registeredIds.length).toBe(before); // 不重复注册
  });
});
