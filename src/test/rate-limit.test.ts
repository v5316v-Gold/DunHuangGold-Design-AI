/**
 * P0 测试：Rate Limiting
 * 覆盖：首次通过/限额内/超限拒绝/时间窗口重置/IP隔离
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Redis 不可用 → rateLimit 走内存降级路径（保持单实例测试语义）
vi.mock('@/lib/redis', () => ({
  getRedis: () => {
    throw new Error('redis unavailable (mock)');
  },
}));

import { rateLimit, getClientIP, AUTH_LIMIT, WRITE_LIMIT, API_LIMIT } from '@/lib/rate-limit';

describe('rateLimit — 基础行为', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('首次请求通过，remaining = limit - 1', async () => {
    const result = await rateLimit('192.168.1.1', AUTH_LIMIT);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(AUTH_LIMIT.limit - 1);
    expect(result.limit).toBe(AUTH_LIMIT.limit);
    expect(result.reset).toBeGreaterThan(0);
  });

  test('第 limit - 1 次请求仍然通过', async () => {
    const ip = '10.0.0.1';
    for (let i = 0; i < AUTH_LIMIT.limit - 1; i++) {
      const r = await rateLimit(ip, AUTH_LIMIT);
      expect(r.success).toBe(true);
    }
  });

  test('第 limit + 1 次请求被拒绝', async () => {
    const ip = '10.0.0.2';
    // 消耗全部配额
    for (let i = 0; i < AUTH_LIMIT.limit; i++) {
      await rateLimit(ip, AUTH_LIMIT);
    }
    // 下一次被限流
    const blocked = await rateLimit(ip, AUTH_LIMIT);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.limit).toBe(AUTH_LIMIT.limit);
  });

  test('WRITE_LIMIT 单独计数不受 AUTH_LIMIT 影响', async () => {
    const ip = '10.0.0.3';
    // 耗尽 AUTH_LIMIT
    for (let i = 0; i < AUTH_LIMIT.limit; i++) {
      await rateLimit(ip, AUTH_LIMIT);
    }
    // AUTH_LIMIT 被限流，但 WRITE_LIMIT 应该正常
    const authBlocked = await rateLimit(ip, AUTH_LIMIT);
    expect(authBlocked.success).toBe(false);

    const writeOk = await rateLimit(ip, WRITE_LIMIT);
    expect(writeOk.success).toBe(true); // WRITE_LIMIT 是独立的
  });

  test('WRITE_LIMIT 默认 5 分钟 30 次', () => {
    expect(WRITE_LIMIT.limit).toBe(30);
    expect(WRITE_LIMIT.window).toBe(5 * 60 * 1000);
  });

  test('AUTH_LIMIT 默认 5 分钟 10 次', () => {
    expect(AUTH_LIMIT.limit).toBe(10);
    expect(AUTH_LIMIT.window).toBe(5 * 60 * 1000);
  });
});

describe('rateLimit — IP 隔离', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('不同 IP 互不影响计数', async () => {
    const ip1 = '1.1.1.1';
    const ip2 = '2.2.2.2';

    // ip1 消耗 9 次
    for (let i = 0; i < AUTH_LIMIT.limit - 1; i++) {
      await rateLimit(ip1, AUTH_LIMIT);
    }

    // ip2 应该还有配额
    const ip2Result = await rateLimit(ip2, AUTH_LIMIT);
    expect(ip2Result.success).toBe(true);
    expect(ip2Result.remaining).toBe(AUTH_LIMIT.limit - 1);

    // ip1 再用 1 次就满了
    const ip1Last = await rateLimit(ip1, AUTH_LIMIT);
    expect(ip1Last.success).toBe(true);
    expect(ip1Last.remaining).toBe(0);

    // ip1 第 11 次被限流
    const ip1Blocked = await rateLimit(ip1, AUTH_LIMIT);
    expect(ip1Blocked.success).toBe(false);

    // ip2 仍然正常
    const ip2StillOk = await rateLimit(ip2, AUTH_LIMIT);
    expect(ip2StillOk.success).toBe(true);
  });

  test('极限边界：同时两个 IP 各请求 limit 次', async () => {
    const ipA = '10.10.10.10';
    const ipB = '20.20.20.20';

    for (let i = 0; i < AUTH_LIMIT.limit; i++) {
      await rateLimit(ipA, AUTH_LIMIT);
      await rateLimit(ipB, AUTH_LIMIT);
    }

    expect((await rateLimit(ipA, AUTH_LIMIT)).success).toBe(false);
    expect((await rateLimit(ipB, AUTH_LIMIT)).success).toBe(false);
    // 两个都限流，互不影响
  });
});

describe('rateLimit — 时间窗口重置', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('窗口过期后配额重置', async () => {
    const ip = '8.8.8.8';

    // 耗尽配额
    for (let i = 0; i < AUTH_LIMIT.limit; i++) {
      await rateLimit(ip, AUTH_LIMIT);
    }
    expect((await rateLimit(ip, AUTH_LIMIT)).success).toBe(false);

    // 快进到窗口结束后（+ 5 分钟 + 1 秒）
    vi.advanceTimersByTime(AUTH_LIMIT.window + 1000);
    vi.setSystemTime(new Date('2026-01-01T00:05:01Z'));

    // 配额重置
    const afterReset = await rateLimit(ip, AUTH_LIMIT);
    expect(afterReset.success).toBe(true);
    expect(afterReset.remaining).toBe(AUTH_LIMIT.limit - 1);
  });

  test('窗口中间时间不重置', async () => {
    const ip = '9.9.9.9';

    for (let i = 0; i < AUTH_LIMIT.limit; i++) {
      await rateLimit(ip, AUTH_LIMIT);
    }
    expect((await rateLimit(ip, AUTH_LIMIT)).success).toBe(false);

    // 快进 3 分钟（不到窗口结束）
    vi.advanceTimersByTime(3 * 60 * 1000);

    // 仍然限流
    const stillBlocked = await rateLimit(ip, AUTH_LIMIT);
    expect(stillBlocked.success).toBe(false);
  });
});

describe('getClientIP', () => {
  test('x-forwarded-for 取第一个 IP', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' },
    });
    expect(getClientIP(req)).toBe('1.2.3.4');
  });

  test('x-forwarded-for 单个 IP', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '8.8.8.8' },
    });
    expect(getClientIP(req)).toBe('8.8.8.8');
  });

  test('x-forwarded-for 带空格', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  1.2.3.4  ,  5.6.7.8  ' },
    });
    expect(getClientIP(req)).toBe('1.2.3.4');
  });

  test('无 x-forwarded-for 时用 x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '8.8.4.4' },
    });
    expect(getClientIP(req)).toBe('8.8.4.4');
  });

  test('两者都没有时返回 127.0.0.1', () => {
    const req = new Request('http://localhost');
    expect(getClientIP(req)).toBe('127.0.0.1');
  });

  test('x-forwarded-for 优先于 x-real-ip', () => {
    const req = new Request('http://localhost', {
      headers: {
        'x-forwarded-for': '1.1.1.1',
        'x-real-ip': '2.2.2.2',
      },
    });
    expect(getClientIP(req)).toBe('1.1.1.1');
  });
});
