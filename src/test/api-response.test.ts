/**
 * P0 测试：API Response Helpers
 * 覆盖：apiSuccess / apiError / unauthorized / badRequest / rateLimitResponse
 *
 * 注意：在 jsdom 测试环境下，NextResponse.json() 的 .json() 方法行为不同，
 * 因此使用 .text() + JSON.parse() 替代来获取响应体。
 */

import { describe, test, expect, vi } from 'vitest';
import {
  apiSuccess,
  apiError,
  unauthorized,
  badRequest,
  forbidden,
  notFound,
  internalError,
  handleCatch,
} from '@/lib/api-response';
import { rateLimitResponse } from '@/lib/rate-limit';

// jsdom 下 Response.json() 行为与浏览器不同，用 text() + parse() 代替
async function parseResponseBody(response: Response) {
  const text = await response.text();
  return JSON.parse(text);
}

describe('apiSuccess', () => {
  test('返回 success:true + data + 200', async () => {
    const result = apiSuccess({ token: 'abc123' });
    expect(result.status).toBe(200);
    const body = await parseResponseBody(result);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ token: 'abc123' });
  });

  test('不接受参数时返回空 data', async () => {
    const result = apiSuccess();
    expect(result.status).toBe(200);
    const body = await parseResponseBody(result);
    expect(body.success).toBe(true);
  });

  test('Content-Type 是 application/json', () => {
    const result = apiSuccess({ ok: true });
    expect(result.headers.get('Content-Type')).toContain('application/json');
  });
});

describe('apiError', () => {
  test('返回 success:false + error + 默认 500', async () => {
    const result = apiError('Something went wrong');
    expect(result.status).toBe(500);
    const body = await parseResponseBody(result);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Something went wrong');
  });

  test('接受自定义状态码', async () => {
    const result = apiError('Not allowed', 403);
    expect(result.status).toBe(403);
    const body = await parseResponseBody(result);
    expect(body.success).toBe(false);
  });

  test('不接受参数时返回默认消息', async () => {
    const result = apiError();
    expect(result.status).toBe(500);
    const body = await parseResponseBody(result);
    expect(body.error).toBeTruthy();
  });
});

describe('unauthorized', () => {
  test('返回 401 状态码', () => {
    expect(unauthorized().status).toBe(401);
  });

  test('返回 success:false + error', async () => {
    const body = await parseResponseBody(unauthorized());
    expect(body.success).toBe(false);
    expect(body.error).toBeTruthy();
  });

  test('不接受参数时返回默认错误消息', async () => {
    const body = await parseResponseBody(unauthorized());
    expect(body.error).toBeTruthy();
    expect(typeof body.error).toBe('string');
  });
});

describe('badRequest', () => {
  test('返回 400 状态码', () => {
    expect(badRequest().status).toBe(400);
  });

  test('接受自定义消息', async () => {
    const body = await parseResponseBody(badRequest('邮箱格式不正确'));
    expect(body.error).toBe('邮箱格式不正确');
  });

  test('不接受参数时返回默认消息', async () => {
    const body = await parseResponseBody(badRequest());
    expect(body.error).toBeTruthy();
  });

  test('返回 success:false', async () => {
    const body = await parseResponseBody(badRequest());
    expect(body.success).toBe(false);
  });
});

describe('forbidden', () => {
  test('返回 403 状态码', () => {
    expect(forbidden().status).toBe(403);
  });

  test('返回 success:false', async () => {
    const body = await parseResponseBody(forbidden());
    expect(body.success).toBe(false);
  });
});

describe('notFound', () => {
  test('返回 404 状态码', () => {
    expect(notFound().status).toBe(404);
  });

  test('接受自定义消息', async () => {
    const body = await parseResponseBody(notFound('资源不存在'));
    expect(body.error).toBe('资源不存在');
  });
});

describe('internalError', () => {
  test('Error 对象作为第一条消息', async () => {
    const result = internalError(new Error('db connection refused'));
    expect(result.status).toBe(500);
    const body = await parseResponseBody(result);
    expect(body.error).toBe('db connection refused');
  });

  test('字符串作为消息', async () => {
    const result = internalError('unknown error' as unknown as Error);
    expect(result.status).toBe(500);
    const body = await parseResponseBody(result);
    expect(body.error).toBeTruthy();
  });
});

describe('handleCatch', () => {
  test('捕获 Error 对象并返回 500', async () => {
    const mockRequest = { headers: () => new Headers() } as unknown as Parameters<typeof handleCatch>[0];
    const result = await handleCatch(mockRequest, async () => {
      throw new Error('test error');
    });
    expect(result.status).toBe(500);
    const body = await parseResponseBody(result);
    expect(body.error).toBe('test error');
  });

  test('捕获字符串并返回 500', async () => {
    const mockRequest = { headers: () => new Headers() } as unknown as Parameters<typeof handleCatch>[0];
    const result = await handleCatch(mockRequest, async () => {
      throw 'string error';
    });
    expect(result.status).toBe(500);
  });

  test('捕获 null/undefined', async () => {
    const mockRequest = { headers: () => new Headers() } as unknown as Parameters<typeof handleCatch>[0];
    const result = await handleCatch(mockRequest, async () => {
      throw null;
    });
    expect(result.status).toBe(500);
  });
});

describe('rateLimitResponse', () => {
  test('返回 429 状态码', async () => {
    const mockResult = {
      success: false,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 300,
      limit: 10,
    };
    const response = rateLimitResponse(mockResult);
    expect(response.status).toBe(429);
  });

  test('包含 X-RateLimit-* 响应头', async () => {
    const mockResult = {
      success: false,
      remaining: 3,
      reset: 1700000000,
      limit: 10,
    };
    const response = rateLimitResponse(mockResult);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('3');
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1700000000');
  });

  test('包含 Retry-After 头', async () => {
    const futureReset = Math.floor(Date.now() / 1000) + 300;
    const response = rateLimitResponse({
      success: false,
      remaining: 0,
      reset: futureReset,
      limit: 10,
    });
    expect(response.headers.get('Retry-After')).toBeTruthy();
  });

  test('body 包含 RATE_LIMITED 错误码', async () => {
    const mockResult = {
      success: false,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 300,
      limit: 10,
    };
    const response = rateLimitResponse(mockResult);
    const body = await parseResponseBody(response);
    expect(body.code).toBe('RATE_LIMITED');
    expect(body.success).toBe(false);
  });

  test('remaining=0 时 content-type 正确', () => {
    const mockResult = {
      success: false,
      remaining: 0,
      reset: Math.floor(Date.now() / 1000) + 300,
      limit: 10,
    };
    const ct = rateLimitResponse(mockResult).headers.get('Content-Type');
    expect(ct).toContain('application/json');
  });
});
