/**
 * Phase 5.4/5.5/5.7 · Workflow 版本化 + Provider 加密 + 缓存失效 单测
 *
 * 运行：npx vitest run --config vitest.node.config.ts src/test/phase5-ext.test.ts
 */
import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '@/db/repositories/provider-repository';

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
    const enc = encryptSecret('«redacted:sk-…»')!;
    process.env.API_KEY_ENCRYPTION_KEY = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const dec = decryptSecret(enc.ciphertext);
    expect(dec).toBeNull();
  });

  it('密钥轮换窗口期：旧 key 加密 → 新 key + PREVIOUS 可解密', () => {
    // 旧 key 加密（模拟轮换前数据）
    process.env.API_KEY_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    delete process.env.API_KEY_ENCRYPTION_KEY_PREVIOUS;
    const enc = encryptSecret('sk-rotate-test')!;

    // 轮换：主 key 换新，旧 key 放 PREVIOUS
    process.env.API_KEY_ENCRYPTION_KEY = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    process.env.API_KEY_ENCRYPTION_KEY_PREVIOUS = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const dec = decryptSecret(enc.ciphertext);
    expect(dec).toBe('sk-rotate-test');
  });

  it('密钥轮换后：新 key 加密 → 旧 PREVIOUS 解不开（AES-GCM tag 校验）', () => {
    process.env.API_KEY_ENCRYPTION_KEY = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    process.env.API_KEY_ENCRYPTION_KEY_PREVIOUS = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const enc = encryptSecret('sk-new-data')!;

    // 模拟只保留旧 key（新 key 丢失）→ 应解密失败
    process.env.API_KEY_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const dec = decryptSecret(enc.ciphertext);
    expect(dec).toBeNull();
  });

  it('无密钥 → encryptSecret 返回 null', () => {
    delete process.env.API_KEY_ENCRYPTION_KEY;
    const enc = encryptSecret('sk-test');
    expect(enc).toBeNull();
  });
});
