/**
 * Phase 9.11 · Sentry 接入单测
 *
 * 验证：
 * - 无 DSN 时 captureError/captureMessage 退化为 console（不抛错）
 * - DSN 配置时通过 spy 验证 @sentry/nextjs 被调用
 * - createLogger().error 自动触发 captureError
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sentry · capture', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.SENTRY_DSN;
  });

  it('无 SENTRY_DSN → captureError 不抛错', async () => {
    const { captureError } = await import('@/lib/sentry/capture');
    await expect(captureError(new Error('test'))).resolves.toBeUndefined();
  });

  it('无 SENTRY_DSN → captureMessage 不抛错', async () => {
    const { captureMessage } = await import('@/lib/sentry/capture');
    await expect(captureMessage('hello')).resolves.toBeUndefined();
  });

  it('有 SENTRY_DSN → captureException 被调用', async () => {
    process.env.SENTRY_DSN = 'https://fake@sentry.io/123';
    const spy = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({
      init: vi.fn(),
      captureException: spy,
      captureMessage: spy,
    }));

    const { captureError } = await import('@/lib/sentry/capture');
    await captureError(new Error('boom'), { tags: { foo: 'bar' } });

    expect(spy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { foo: 'bar' }, level: 'error' })
    );
  });

  it('有 SENTRY_DSN → captureMessage 上报到指定 level', async () => {
    process.env.SENTRY_DSN = 'https://fake@sentry.io/123';
    const spy = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({
      init: vi.fn(),
      captureException: spy,
      captureMessage: spy,
    }));

    const { captureMessage } = await import('@/lib/sentry/capture');
    await captureMessage('warning-test', { level: 'warning' });

    expect(spy).toHaveBeenCalledWith(
      'warning-test',
      expect.objectContaining({ level: 'warning' })
    );
  });
});

describe('error-handler · Logger 自动联动 Sentry', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.SENTRY_DSN;
  });

  it('logger.error 调用不抛错（无 DSN 模式）', async () => {
    const { createLogger } = await import('@/lib/error-handler');
    const log = createLogger('test');
    expect(() => log.error('test message', { foo: 'bar' })).not.toThrow();
  });

  it('有 DSN → logger.error 触发 captureError', async () => {
    process.env.SENTRY_DSN = 'https://fake@sentry.io/123';
    const spy = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({
      init: vi.fn(),
      captureException: spy,
      captureMessage: spy,
    }));

    const { createLogger } = await import('@/lib/error-handler');
    const log = createLogger('phase9-test');

    log.error('integration test', { ctx: 'verify' });

    // 等待异步 import 完成
    await new Promise((r) => setTimeout(r, 50));

    expect(spy).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ logger: 'phase9-test' }),
      })
    );
  });
});