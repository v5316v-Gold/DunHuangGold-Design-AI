/**
 * E2E 关键业务流程测试（API 集成层）
 *
 * 说明：
 *   - 需要真实服务器 + 数据库（localhost:3000）
 *   - 改为条件执行：服务器可达时自动运行，否则跳过
 *     （避免无条件 skip 造成"测试空转"的误导）
 *   - 生产方式：pnpm dev 或 pnpm start 后，vitest run src/test/e2e.test.ts
 */

import { describe, test, expect, vi, beforeEach, afterAll } from 'vitest';

// ============================================================
// 辅助函数
// ============================================================
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

/** 检测服务器是否可达；不可达则跳过 E2E 套件 */
async function isServerReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${BASE_URL}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

const serverReady = await isServerReachable();
const e2eDescribe = serverReady ? describe : describe.skip;

async function apiCall(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
) {
  const { method = 'GET', body, headers = {} } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

// ============================================================
// 认证链路测试
// ============================================================

e2eDescribe('E2E — 用户注册', () => {
  const uniqueEmail = `e2e-test-${Date.now()}@test.com`;
  const password = 'test123456';

  test('注册成功返回 200 + user + token', async () => {
    const res = await apiCall('/api/auth/register', {
      method: 'POST',
      body: {
        email: uniqueEmail,
        password,
        nickname: 'E2E Test User',
      },
    });

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.token).toBeTruthy();
    expect(body.data?.user?.email).toBe(uniqueEmail);
  });

  test('重复邮箱注册失败', async () => {
    const res = await apiCall('/api/auth/register', {
      method: 'POST',
      body: { email: uniqueEmail, password: 'anything', nickname: 'Dup' },
    });
    // 应该是 400 或 409
    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('密码少于 6 位失败', async () => {
    const res = await apiCall('/api/auth/register', {
      method: 'POST',
      body: { email: 'short-pw@test.com', password: '12345', nickname: 'Test' },
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  test('缺少必填字段失败', async () => {
    const res = await apiCall('/api/auth/register', {
      method: 'POST',
      body: { email: 'missing@test.com' }, // password 缺失
    });
    expect(res.ok).toBe(false);
  });
});

e2eDescribe('E2E — 用户登录', () => {
  const testEmail = `login-test-${Date.now()}@test.com`;
  const testPassword = 'login123';

  beforeAll(async () => {
    // 创建测试用户
    await apiCall('/api/auth/register', {
      method: 'POST',
      body: { email: testEmail, password: testPassword, nickname: 'LoginTest' },
    });
  });

  test('正确账号密码登录成功', async () => {
    const res = await apiCall('/api/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: testPassword },
    });

    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data?.token).toBeTruthy();
    expect(body.data?.user?.email).toBe(testEmail);
  });

  test('错误密码登录失败', async () => {
    const res = await apiCall('/api/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'wrongpassword' },
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
  });

  test('不存在的邮箱登录失败', async () => {
    const res = await apiCall('/api/auth/login', {
      method: 'POST',
      body: { email: 'not-exist-xxx@test.com', password: 'any' },
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(401);
  });
});

e2eDescribe('E2E — Auth 保护路由', () => {
  test('/api/auth/me 无 token 返回 401', async () => {
    const res = await apiCall('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('/api/auth/me 带无效 token 返回 401', async () => {
    const res = await apiCall('/api/auth/me', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(res.status).toBe(401);
  });

  test('/api/auth/me 带有效 token 返回用户信息', async () => {
    // 先注册+登录获取 token
    const unique = `authtest-${Date.now()}@test.com`;
    await apiCall('/api/auth/register', {
      method: 'POST',
      body: { email: unique, password: 'test123456', nickname: 'AuthTest' },
    });
    const loginRes = await apiCall('/api/auth/login', {
      method: 'POST',
      body: { email: unique, password: 'test123456' },
    });
    const { token } = await loginRes.json();

    const meRes = await apiCall('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meRes.ok).toBe(true);
    const me = await meRes.json();
    expect(me.data?.email).toBe(unique);
  });
});

e2eDescribe('E2E — Rate Limiting', () => {
  test('同一 IP 快速登录 10 次后第 11 次返回 429', async () => {
    const ip = `rate-test-${Date.now()}`;
    const targetEmail = `ratelimit-test-${Date.now()}@test.com`;

    // 注册一个账号用于测试
    await apiCall('/api/auth/register', {
      method: 'POST',
      body: { email: targetEmail, password: 'test123456', nickname: 'RateTest' },
    });

    // 连续 10 次错误密码登录（触发限流）
    const wrongPassword = 'wrong-password-xxx';
    let rateLimited = false;

    for (let i = 0; i < 10; i++) {
      const res = await apiCall('/api/auth/login', {
        method: 'POST',
        headers: { 'X-Real-IP': ip },
        body: { email: targetEmail, password: wrongPassword },
      });
      if (res.status === 429) {
        rateLimited = true;
        break;
      }
    }

    // 如果还没限流，继续请求直到触发
    if (!rateLimited) {
      const lastRes = await apiCall('/api/auth/login', {
        method: 'POST',
        headers: { 'X-Real-IP': ip },
        body: { email: targetEmail, password: wrongPassword },
      });
      expect(lastRes.status).toBe(429);
    } else {
      // 已经在循环中触发
      expect(rateLimited).toBe(true);
    }
  }, 30000); // 超时 30s
});

e2eDescribe('E2E — 权限边界', () => {
  const regularEmail = `regular-${Date.now()}@test.com`;
  let regularToken: string;

  beforeAll(async () => {
    // 注册普通用户
    await apiCall('/api/auth/register', {
      method: 'POST',
      body: { email: regularEmail, password: 'test123456', nickname: 'Regular' },
    });
    const loginRes = await apiCall('/api/auth/login', {
      method: 'POST',
      body: { email: regularEmail, password: 'test123456' },
    });
    regularToken = (await loginRes.json()).data?.token;
  });

  test('普通用户不能访问 admin 路由', async () => {
    const res = await apiCall('/api/admin/users', {
      headers: { Authorization: `Bearer ${regularToken}` },
    });
    // 应该返回 401（未授权）而非 admin 数据
    expect(res.status).toBe(401);
  });
});
