/**
 * Phase 5.4/5.5/5.7 · Workflow 版本化 + Provider 加密 + 缓存失效 单测
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/phase5-ext.test.ts
 */
import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '@/db/repositories/provider-repository';
import { cacheGet, cacheInvalidate } from '@/lib/ai/application/cache-invalidation';

// Mock redis（避免真实连接）
vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    get: vi.fn(async () => null),
    set: vi.fn(async () => 'OK'),
    del: vi.fn(async () => 1),
  }),
}));

import { vi } from 'vitest';

describe('provider-repository · 凭据加密（AES-256-GCM）', () => {
  it('加密后可解密还原（密钥一致）', () => {
    process.env.API_KEY_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const enc = encryptSecret('sk-test-123456');
    expect(enc).not.toBeNull();
    expect(enc!.fingerprint).toHaveLength(16);
    const dec = decryptSecret(enc!.ciphertext);
    expect(dec).toBe('sk-test-123456');
    // 密文不含明文
    expect(enc!.ciphertext).not.toContain('sk-test');
  });

  it('密钥不匹配 → 解密失败返回 null', () => {
    process.env.API_KEY_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const enc = encryptSecret('sk-test-123456')!;
    process.env.API_KEY_ENCRYPTION_KEY = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const dec = decryptSecret(enc.ciphertext);
    expect(dec).toBeNull();
  });

  it('无密钥 → encryptSecret 返回 null', () => {
    delete process.env.API_KEY_ENCRYPTION_KEY;
    const enc = encryptSecret('sk-test');
    expect(enc).toBeNull();
  });
});

describe('cache-invalidation · Redis 缓存联动', () => {
  it('cacheGet 无缓存 → 走 fetchFn + 回填', async () => {
    const fetchFn = vi.fn(async () => ({ a: 1 }));
    const value = await cacheGet('test:key', fetchFn);
    expect(value).toEqual({ a: 1 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('cacheInvalidate 不抛错（Redis mock）', async () => {
    await expect(cacheInvalidate('test:key')).resolves.toBeUndefined();
  });
});
