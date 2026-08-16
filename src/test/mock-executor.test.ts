/**
 * P1 · MockExecutor 生产守卫测试（ADR-010）
 *
 * 覆盖：
 *  - 生产环境（NODE_ENV=production）默认拒绝 mock 执行
 *  - ALLOW_MOCK_IN_PRODUCTION=true 灰度开关显式放行
 *  - 非生产环境正常执行
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/mock-executor.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockExecutor } from '@/lib/orchestrator/executors/mock-executor';

describe('MockExecutor · ADR-010 生产守卫', () => {
  let executor: MockExecutor;

  beforeEach(() => {
    executor = new MockExecutor();
    // 清理环境变量，避免污染
    delete process.env.ALLOW_MOCK_IN_PRODUCTION;
  });

  afterEach(() => {
    delete process.env.ALLOW_MOCK_IN_PRODUCTION;
    delete process.env.NODE_ENV;
  });

  it('非生产环境 → mock 正常执行（开发/测试降级路径）', async () => {
    process.env.NODE_ENV = 'development';
    const r = await executor.execute({
      featureId: 'text2img',
      userId: 'u1',
      inputs: { prompt: 'test' },
      traceId: 'trace-dev',
    });
    expect(r.success).toBe(true);
  });

  it('生产环境 + 无灰度开关 → 拒绝执行（MOCK_FORBIDDEN）', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_MOCK_IN_PRODUCTION;
    const r = await executor.execute({
      featureId: 'text2img',
      userId: 'u1',
      inputs: { prompt: 'test' },
      traceId: 'trace-prod',
    });
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('MOCK_FORBIDDEN');
  });

  it('生产环境 + ALLOW_MOCK_IN_PRODUCTION=true → 显式放行（灰度）', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_MOCK_IN_PRODUCTION = 'true';
    const r = await executor.execute({
      featureId: 'text2img',
      userId: 'u1',
      inputs: { prompt: 'test' },
      traceId: 'trace-gray',
    });
    expect(r.success).toBe(true);
  });

  it('生产环境 + 非 "true" 灰度值 → 仍拒绝（仅精确匹配 true 放行）', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_MOCK_IN_PRODUCTION = '1'; // 非字符串 "true"
    const r = await executor.execute({
      featureId: 'relief',
      userId: 'u1',
      inputs: { prompt: 'test' },
      traceId: 'trace-gray2',
    });
    expect(r.success).toBe(false);
    expect(r.error?.code).toBe('MOCK_FORBIDDEN');
  });
});
