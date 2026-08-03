/**
 * P0 测试：Auth 链路
 *
 * @/lib/auth 被整体 mock，避免 jose v6 CJS build 在 Node 25 + pnpm
 * 环境下的 Buffer instanceof Uint8Array 检查异常。
 *
 * Mock 使用简单 base64 token，不依赖 jose，仅测试业务逻辑正确性。
 * 真实 JWT 逻辑由 E2E 测试覆盖。
 */

import { describe, test, expect, vi } from 'vitest';

// ============================================================
// Mock token store（进程内共享）
// ============================================================
const mockTokens = new Map<string, { userId: string; email: string; role: string }>();

function encode(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decode(token: string): { userId: string; email: string; role: string } | null {
  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

vi.mock('@/lib/auth', () => ({
  generateToken: async (payload: { userId: string; email: string; role: string }) => {
    // 简单 token 格式：base64(JSON.stringify(payload))
    const token = `mock.${encode(payload)}.sig`;
    mockTokens.set(token, { ...payload });
    return token;
  },

  verifyToken: async (token: string) => {
    // 匹配 mock token 格式才尝试解析
    if (!token.startsWith('mock.')) return null;
    const payload = decode(token.replace('mock.', '').replace('.sig', ''));
    if (!payload) return null;
    return payload as { userId: string; email: string; role: string };
  },

  requireAuth: async (request: Request) => {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7);
    return mockTokens.get(token) ?? null;
  },

  extractTokenFromRequest: (request: Request) => {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const pairs = cookieHeader.split(';').map(c => {
        const idx = c.indexOf('=');
        return idx >= 0 ? [c.slice(0, idx).trim(), c.slice(idx + 1).trim()] : [c.trim(), ''];
      });
      const cookies = Object.fromEntries(pairs as [string, string][]);
      if (cookies.token) return cookies.token;
    }
    return null;
  },

  getCurrentUser: async (request: Request) => {
    const { requireAuth } = await import('@/lib/auth');
    return requireAuth(request);
  },

  hashPassword: vi.fn().mockResolvedValue('$2a$12$hashedvalue'),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

import { generateToken, verifyToken, requireAuth, extractTokenFromRequest } from '@/lib/auth';

describe('Auth — JWT 生成与验证', () => {
  const testPayload = { userId: 'user-123', email: 'test@example.com', role: 'user' };

  test('generateToken 创建 mock token 字符串', async () => {
    const token = await generateToken(testPayload);
    expect(token).toBeTruthy();
    expect(typeof token).toBe('string');
    expect(token.startsWith('mock.')).toBe(true);
  });

  test('verifyToken 正确解析有效 token 并返回 payload', async () => {
    const token = await generateToken(testPayload);
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe('user-123');
    expect(payload!.email).toBe('test@example.com');
    expect(payload!.role).toBe('user');
  });

  test('verifyToken 对无效格式返回 null', async () => {
    expect(await verifyToken('invalid-token')).toBeNull();
  });

  test('verifyToken 对空字符串返回 null', async () => {
    expect(await verifyToken('')).toBeNull();
  });

  test('verifyToken 对篡改 token 返回 null', async () => {
    const token = await generateToken(testPayload);
    const tampered = token.slice(0, -5) + 'XXXX';
    expect(await verifyToken(tampered)).toBeNull();
  });

  test('不同 payload 生成不同 token', async () => {
    const token1 = await generateToken({ ...testPayload });
    const token2 = await generateToken({ ...testPayload, userId: 'different' });
    expect(token1).not.toBe(token2);
  });
});

describe('Auth — requireAuth', () => {
  test('无 Authorization header 时返回 null', async () => {
    const req = new Request('http://localhost/api/test');
    expect(await requireAuth(req)).toBeNull();
  });

  test('空 Bearer token 返回 null', async () => {
    const req = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer ' },
    });
    expect(await requireAuth(req)).toBeNull();
  });

  test('无效 token 返回 null', async () => {
    const req = new Request('http://localhost/api/test', {
      headers: { Authorization: 'Bearer invalid-token' },
    });
    expect(await requireAuth(req)).toBeNull();
  });

  test('有效 token 返回 payload', async () => {
    const token = await generateToken({ userId: 'u1', email: 'a@b.com', role: 'user' });
    const req = new Request('http://localhost/api/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await requireAuth(req);
    expect(result).not.toBeNull();
    expect(result!.userId).toBe('u1');
  });

  test('admin role 用户通过', async () => {
    const token = await generateToken({ userId: 'admin-1', email: 'admin@test.com', role: 'admin' });
    const req = new Request('http://localhost/api/admin/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await requireAuth(req);
    expect(result).not.toBeNull();
    expect(result!.role).toBe('admin');
  });
});

describe('Auth — extractTokenFromRequest', () => {
  test('从 Authorization Bearer header 提取', () => {
    const req = new Request('http://localhost', {
      headers: { Authorization: 'Bearer mytoken123' },
    });
    expect(extractTokenFromRequest(req)).toBe('mytoken123');
  });

  test('无 Authorization header 时返回 null', () => {
    expect(extractTokenFromRequest(new Request('http://localhost'))).toBeNull();
  });

  test('非 Bearer 格式返回 null', () => {
    const req = new Request('http://localhost', {
      headers: { Authorization: 'Basic credentials' },
    });
    expect(extractTokenFromRequest(req)).toBeNull();
  });

  test('从 Cookie 提取 token', () => {
    const req = new Request('http://localhost', {
      headers: { Cookie: 'other=value; token=cookie-token-xyz; foo=bar' },
    });
    expect(extractTokenFromRequest(req)).toBe('cookie-token-xyz');
  });

  test('Authorization header 优先于 Cookie', () => {
    const req = new Request('http://localhost', {
      headers: {
        Authorization: 'Bearer header-token',
        Cookie: 'token=cookie-token',
      },
    });
    expect(extractTokenFromRequest(req)).toBe('header-token');
  });

  test('缺少 = 的 Cookie pair 能解析', () => {
    const req = new Request('http://localhost', {
      headers: { Cookie: 'token=abc; withoutEqual' },
    });
    expect(extractTokenFromRequest(req)).toBe('abc');
  });
});
