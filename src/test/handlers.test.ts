/**
 * Phase 4.5 · Handler 适配单测
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/handlers.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import '@/lib/ai/registry/register-all';
import { registry } from '@/lib/ai-service/service-registry';
import { buildHandlerRegistry, getHandler } from '@/lib/ai/handlers/handler-adapters';
import { runHandler } from '@/lib/ai/handlers/handler.types';

describe('handlers · 17 服务 handler 化', () => {
  let handlers: Map<string, import('@/lib/ai/handlers/handler.types').FeatureHandler>;

  beforeAll(() => {
    handlers = buildHandlerRegistry();
  });

  it('registry 已注册 17+ 服务', () => {
    expect(registry.list().length).toBeGreaterThanOrEqual(17);
  });

  it('每个注册服务都有对应 handler', () => {
    for (const config of registry.list()) {
      expect(handlers.has(config.type)).toBe(true);
    }
  });

  it('handler 元数据正确（text2img）', () => {
    const h = handlers.get('text2img');
    expect(h).toBeDefined();
    expect(h?.label).toBe('文生图');
    expect(h?.powerCost).toBeGreaterThan(0);
    expect(h?.requiresImage).toBe(false);
  });

  it('requiresImage 服务校验缺图（refine）', () => {
    const h = handlers.get('refine');
    expect(h?.requiresImage).toBe(true);
    const err = h?.validate({ prompt: 'no image' });
    expect(err).toContain('图片');
  });

  it('requiresImage 服务带图通过（refine）', () => {
    const h = handlers.get('refine');
    const err = h?.validate({ prompt: 'x', image: 'https://a.com/x.png' });
    expect(err).toBeNull();
  });
});

describe('runHandler · 三阶段流程', () => {
  it('validate 失败 → INVALID_INPUT', async () => {
    const h = getHandler('refine')!;
    const outcome = await runHandler(h, { prompt: 'no image' });
    expect(outcome.success).toBe(false);
    expect(outcome.error?.code).toBe('INVALID_INPUT');
  });

  it('execute 成功 → 返回结果', async () => {
    const h = getHandler('text2img')!;
    // text2img 需要 comfyui 或云端，无环境时可能失败 —— 用 mock execute 验证流程
    const mockH = {
      ...h,
      execute: async () => ({
        success: true,
        data: ['https://x/a.png'],
        provider: 'mock' as const,
        powerCost: 10,
      }),
    };
    const outcome = await runHandler(mockH, { prompt: 'hello' });
    expect(outcome.success).toBe(true);
    expect(outcome.result?.data).toEqual(['https://x/a.png']);
  });

  it('execute 异常 → retryable 错误', async () => {
    const h = getHandler('text2img')!;
    const mockH = {
      ...h,
      execute: async () => {
        throw new Error('provider down');
      },
    };
    const outcome = await runHandler(mockH, { prompt: 'hello' });
    expect(outcome.success).toBe(false);
    expect(outcome.error?.retryable).toBe(true);
  });

  it('postProcess 执行', async () => {
    const h = getHandler('text2img')!;
    const mockH = {
      ...h,
      execute: async () => ({ success: true, data: ['https://x/a.png'], provider: 'mock' as const, powerCost: 10 }),
      postProcess: (r: { success: boolean; data: string[] | undefined; provider: string }) => ({
        ...r,
        data: r.data?.map((u) => `${u}?processed=1`),
      }),
    };
    const outcome = await runHandler(mockH, { prompt: 'hello' });
    expect(outcome.result?.data?.[0]).toContain('processed=1');
  });
});
