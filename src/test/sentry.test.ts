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

  it('有 DSN → captureMessage 上报到指定 level', async () => {
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

  it('PII 脱敏：password/token/secret 自动 [REDACTED]', async () => {
    process.env.SENTRY_DSN = 'https://fake@sentry.io/123';
    const spy = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({
      init: vi.fn(),
      captureException: spy,
      captureMessage: spy,
    }));

    const { captureError } = await import('@/lib/sentry/capture');
    await captureError(new Error('leak test'), {
      extra: {
        password: 'secret123',
        apiKey: 'ak-test',
        token: 'tk-test',
        safeField: 'visible',
      },
    });

    const callArgs = spy.mock.calls[0][1];
    expect(callArgs.extra.password).toBe('[REDACTED]');
    expect(callArgs.extra.apiKey).toBe('[REDACTED]');
    expect(callArgs.extra.token).toBe('[REDACTED]');
    expect(callArgs.extra.safeField).toBe('visible');
  });

  it('邮箱自动脱敏', async () => {
    process.env.SENTRY_DSN = 'https://fake@sentry.io/123';
    const spy = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({
      init: vi.fn(),
      captureException: spy,
      captureMessage: spy,
    }));

    const { captureError } = await import('@/lib/sentry/capture');
    await captureError(new Error('email test'), {
      extra: { note: 'Contact user@example.com' },
    });

    const callArgs = spy.mock.calls[0][1];
    expect(callArgs.extra.note).toBe('Contact us***@example.com');
  });

  it('setSentryUser 调用不抛错（无 DSN 模式）', async () => {
    delete process.env.SENTRY_DSN;
    const { setSentryUser, clearSentryUser } = await import('@/lib/sentry/capture');
    await expect(setSentryUser({ id: 'u1', email: 'u@x.com' })).resolves.toBeUndefined();
    await expect(clearSentryUser()).resolves.toBeUndefined();
  });

  it('setSentryUser 有 DSN → setUser 被调用', async () => {
    process.env.SENTRY_DSN = 'https://fake@sentry.io/123';
    const spy = vi.fn();
    vi.doMock('@sentry/nextjs', () => ({
      init: vi.fn(),
      setUser: spy,
      setUser: spy,
      captureException: vi.fn(),
      captureMessage: vi.fn(),
    }));

    const { setSentryUser } = await import('@/lib/sentry/capture');
    await setSentryUser({ id: 'u123', email: 'alice@x.com', username: 'alice' });

    expect(spy).toHaveBeenCalledWith({
      id: 'u123',
      email: 'alice@x.com',
      username: 'alice',
    });
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

    // 等待异步 import 完成（并发下固定 50ms 不可靠，改为轮询等待）
    await vi.waitFor(() => {
      expect(spy).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({ logger: 'phase9-test' }),
        })
      );
    }, { timeout: 2000, interval: 20 });
  });
});