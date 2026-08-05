/**
 * Phase 2/3 单测：API envelope + middleware（Phase 3.6 已重启用）
 * 验证：16 错误码 + envelope 格式 + idempotency 防双扣
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { z } from 'zod';

// Mock redis
const mockRedisStore = new Map<string, string>();
const mockRedisSet = vi.fn(async (key: string, value: string, ...args: any[]) => {
  const exIndex = args.indexOf('EX');
  const nxIndex = args.indexOf('NX');
  const ttl = exIndex > -1 ? args[exIndex + 1] : 0;
  const nx = nxIndex > -1;
  if (nx && mockRedisStore.has(key)) return null;
  mockRedisStore.set(key, value);
  if (ttl > 0) setTimeout(() => mockRedisStore.delete(key), ttl * 1000);
  return 'OK';
});
const mockRedisGet = vi.fn(async (key: string) => mockRedisStore.get(key) ?? null);
const mockRedisIncr = vi.fn(async (key: string) => {
  const cur = parseInt(mockRedisStore.get(key) || '0', 10) + 1;
  mockRedisStore.set(key, String(cur));
  return cur;
});
const mockRedisExpire = vi.fn(async () => 1);

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    set: mockRedisSet,
    get: mockRedisGet,
    incr: mockRedisIncr,
    expire: mockRedisExpire,
  }),
}));

// Mock auth
const mockPayload = { userId: 'u1', email: 't@t.com', role: 'user' };
vi.mock('@/lib/auth', () => ({
  verifyToken: vi.fn(async (token: string) => (token === 'valid' ? mockPayload : null)),
}));

import {
  API_ERROR_CODES,
  ERROR_CODE_TO_HTTP_STATUS,
  ok,
  fail,
  ApiErrors,
} from '@/lib/api/envelope';
import {
  withAuth,
  withAdmin,
  withValidation,
  withIdempotency,
  withRateLimit,
  withAudit,
} from '@/lib/api/middleware';

// ============================================
// Envelope
// ============================================

describe('API Envelope · 16 错误码 + 格式', () => {
  it('所有 16 个错误码都已定义', () => {
    const expected = [
      'AUTH_REQUIRED', 'INVALID_CREDENTIALS', 'PERMISSION_DENIED', 'INVALID_INPUT',
      'FEATURE_NOT_FOUND', 'FEATURE_DISABLED', 'INSUFFICIENT_POWER', 'DUPLICATE_REQUEST',
      'TASK_NOT_FOUND', 'TASK_NOT_CANCELLABLE', 'PROVIDER_UNAVAILABLE', 'WORKFLOW_NOT_FOUND',
      'WORKFLOW_FAILED', 'STORAGE_FAILED', 'RATE_LIMITED', 'INTERNAL_ERROR',
    ];
    for (const code of expected) {
      expect(API_ERROR_CODES).toHaveProperty(code);
    }
    expect(Object.keys(API_ERROR_CODES)).toHaveLength(16);
  });

  it('每个错误码都映射到正确 HTTP 状态', () => {
    for (const code of Object.values(API_ERROR_CODES)) {
      expect(ERROR_CODE_TO_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
      expect(ERROR_CODE_TO_HTTP_STATUS[code]).toBeLessThan(600);
    }
    expect(ERROR_CODE_TO_HTTP_STATUS.AUTH_REQUIRED).toBe(401);
    expect(ERROR_CODE_TO_HTTP_STATUS.PERMISSION_DENIED).toBe(403);
    expect(ERROR_CODE_TO_HTTP_STATUS.RATE_LIMITED).toBe(429);
    expect(ERROR_CODE_TO_HTTP_STATUS.DUPLICATE_REQUEST).toBe(409);
  });

  it('ok() 构造正确 success 响应', async () => {
    const res = ok({ id: 1 }, { requestId: 'r1' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, data: { id: 1 }, requestId: 'r1', meta: undefined });
  });

  it('fail() 构造正确 error 响应 + HTTP 状态', async () => {
    const res = fail(API_ERROR_CODES.FEATURE_NOT_FOUND, 'no such feature', {
      requestId: 'r2',
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toMatchObject({
      success: false,
      error: { code: 'FEATURE_NOT_FOUND', message: 'no such feature' },
      requestId: 'r2',
    });
  });

  it('便捷别名都正确', async () => {
    const res = ApiErrors.authRequired('r3');
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_REQUIRED');
    expect(res.status).toBe(401);
  });
});

// ============================================
// Middleware
// ============================================

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL('http://localhost:5000/api/test'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('withAuth · 鉴权中间件', () => {
  it('无 token → AUTH_REQUIRED 401', async () => {
    const handler = withAuth(async (ctx, body) => ok(body, ctx));
    const res = await handler(makeRequest({}));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });

  it('无效 token → INVALID_CREDENTIALS 401', async () => {
    const handler = withAuth(async (ctx, body) => ok(body, ctx));
    const res = await handler(makeRequest({ authorization: 'Bearer invalid' }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('有效 token → 200 + ctx.user 有数据', async () => {
    const handler = withAuth(async (ctx, body) => ok({ userId: ctx.user?.id }, ctx));
    const res = await handler(makeRequest({ authorization: 'Bearer valid' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.userId).toBe('u1');
  });
});

describe('withAdmin · 管理员鉴权', () => {
  it('普通用户被拒绝 PERMISSION_DENIED 403', async () => {
    const handler = withAdmin(async (ctx, body) => ok(body, ctx));
    const res = await handler(makeRequest({ authorization: 'Bearer valid' })); // user role
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('PERMISSION_DENIED');
  });
});

describe('withValidation · Zod 校验', () => {
  const schema = z.object({ name: z.string().min(2) });

  it('合法 body → handler 执行', async () => {
    const handler = withValidation(schema)(async (ctx, body) => ok(body, ctx));
    const req = new NextRequest(new URL('http://localhost:5000/api/test'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'ok' }),
    });
    const res = await handler(req);
    expect(res.status).toBe(200);
  });

  it('非法 body → INVALID_INPUT 400', async () => {
    const handler = withValidation(schema)(async (ctx, body) => ok(body, ctx));
    const req = new NextRequest(new URL('http://localhost:5000/api/test'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'x' }),  // too short
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_INPUT');
    // Zod 错误会带 details（issues 列表）
    expect(body.error.details).toBeDefined();
  });
});

describe('withIdempotency · 幂等防双扣', () => {
  beforeEach(() => mockRedisStore.clear());
  afterEach(() => vi.clearAllMocks());

  it('缺 Idempotency-Key → INVALID_INPUT 400', async () => {
    const handler = withIdempotency(async (ctx, body) => ok(body, ctx));
    const res = await handler(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  it('首次请求正常执行', async () => {
    const handler = withIdempotency(async (ctx, body) => ok(body, ctx));
    const res = await handler(
      makeRequest({ 'idempotency-key': 'k1', 'x-real-ip': '127.0.0.1' })
    );
    expect(res.status).toBe(200);
  });

  it('同 key + 同 body 第二次 → DUPLICATE_REQUEST 409', async () => {
    let callCount = 0;
    const handler = withIdempotency(async (ctx, body) => {
      callCount++;
      return ok({ count: callCount }, ctx);
    });
    const reqOpts = { 'idempotency-key': 'k2', 'x-real-ip': '127.0.0.1' };
    const r1 = await handler(makeRequest(reqOpts));
    const r2 = await handler(makeRequest(reqOpts));
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(409);
    expect(callCount).toBe(1);  // handler 只调用了一次
    const body = await r2.json();
    expect(body.error.code).toBe('DUPLICATE_REQUEST');
  });
});

describe('withRateLimit · 限流', () => {
  beforeEach(() => mockRedisStore.clear());
  afterEach(() => vi.clearAllMocks());

  it('超限返回 RATE_LIMITED 429', async () => {
    // 关键：直接测限流逻辑本身（不受 skipRateLimit 影响）—— 临时设 NODE_ENV=production
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = 'production';
    try {
      const handler = withRateLimit({ windowMs: 60_000, max: 2 })(async (ctx, body) => ok(body, ctx));
      const reqOpts = { 'x-real-ip': '1.2.3.4' };
      await handler(makeRequest(reqOpts));
      await handler(makeRequest(reqOpts));
      const r3 = await handler(makeRequest(reqOpts));
      expect(r3.status).toBe(429);
      const body = await r3.json();
      expect(body.error.code).toBe('RATE_LIMITED');
    } finally {
      (process.env as Record<string, string>).NODE_ENV = originalEnv ?? '';
    }
  });
});
