/**
 * Phase 5.5 · ProviderRepository（Provider 注册表 Repository）
 *
 * ADR-012（DB 运行时配置）+ ADR-014（Repository 抽象）
 *
 * - provider CRUD（DB 不可用内存降级）
 * - 凭据加密存储（AES-256-GCM，禁止明文，禁止日志打印 Key）
 */

import { eq } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { db } from '@/db';
import { providers, providerCredentials } from '@/db/schema/providers';
import { withRetry } from './db-retry';

/** 非空 DB 引用（调用处均已判 db 非空） */
const dbc = db as NonNullable<typeof db>;
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('provider-repo');

export interface ProviderRow {
  id: string;
  name: string;
  kind: 'cloud' | 'local';
  baseUrl: string | null;
  enabled: boolean;
  health: string;
  lastLatencyMs: number | null;
}

// ==================== 凭据加密（AES-256-GCM） ====================

function getEncryptionKey(): Buffer | null {
  const key = process.env.API_KEY_ENCRYPTION_KEY;
  if (!key) return null;
  return Buffer.from(key, 'hex');
}

/** 加密 API Key → ciphertext:iv:tag */
export function encryptSecret(plain: string): { ciphertext: string; fingerprint: string } | null {
  const key = getEncryptionKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const fingerprint = createHash('sha256').update(plain).digest('hex').slice(0, 16);
  return {
    ciphertext: `${enc.toString('base64')}:${iv.toString('base64')}:${tag.toString('base64')}`,
    fingerprint,
  };
}

/** 解密 API Key */
export function decryptSecret(stored: string): string | null {
  const key = getEncryptionKey();
  if (!key) return null;
  try {
    const [encB64, ivB64, tagB64] = stored.split(':');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(encB64, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch (error) {
    logger.error('凭据解密失败（密钥不匹配或数据损坏）', error);
    return null;
  }
}

// ==================== Repository ====================

export class ProviderRepository {
  /** 列出所有 provider */
  async list(): Promise<ProviderRow[]> {
    if (!db) return [];
    try {
      const rows = await withRetry(() => dbc.select().from(providers));
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        kind: (r.kind ?? 'cloud') as 'cloud' | 'local',
        baseUrl: r.baseUrl,
        enabled: r.enabled ?? true,
        health: r.health ?? 'unknown',
        lastLatencyMs: r.lastLatencyMs,
      }));
    } catch {
      return [];
    }
  }

  /** 按 id 查 */
  async findById(id: string): Promise<ProviderRow | null> {
    if (!db) return null;
    try {
      const rows = await withRetry(() =>
        dbc.select().from(providers).where(eq(providers.id, id)).limit(1)
      );
      const r = rows[0];
      return r
        ? {
            id: r.id,
            name: r.name,
            kind: (r.kind ?? 'cloud') as 'cloud' | 'local',
            baseUrl: r.baseUrl,
            enabled: r.enabled ?? true,
            health: r.health ?? 'unknown',
            lastLatencyMs: r.lastLatencyMs,
          }
        : null;
    } catch {
      return null;
    }
  }

  /** upsert provider */
  async upsert(input: {
    id: string;
    name: string;
    kind?: 'cloud' | 'local';
    baseUrl?: string;
    enabled?: boolean;
  }): Promise<boolean> {
    if (!db) return false;
    try {
      await withRetry(() =>
        dbc
          .insert(providers)
          .values({
            id: input.id,
            name: input.name,
            kind: input.kind ?? 'cloud',
            baseUrl: input.baseUrl ?? null,
            enabled: input.enabled ?? true,
          })
          .onConflictDoUpdate({
            target: providers.id,
            set: {
              name: input.name,
              kind: input.kind ?? 'cloud',
              baseUrl: input.baseUrl ?? null,
              enabled: input.enabled ?? true,
              updatedAt: new Date(),
            },
          })
      );
      return true;
    } catch {
      return false;
    }
  }

  /** 保存凭据（加密存储） */
  async saveCredential(
    providerId: string,
    apiKey: string,
    name = 'primary'
  ): Promise<{ ok: boolean; fingerprint?: string; error?: string }> {
    if (!db) return { ok: false, error: 'DB 不可用' };
    const encrypted = encryptSecret(apiKey);
    if (!encrypted) {
      return { ok: false, error: 'API_KEY_ENCRYPTION_KEY 未配置' };
    }
    try {
      // 同 provider + name 覆盖
      await withRetry(() =>
        dbc
          .insert(providerCredentials)
          .values({
            providerId,
            name,
            encryptedKey: encrypted.ciphertext,
            keyFingerprint: encrypted.fingerprint,
          })
          .onConflictDoUpdate({
            target: [providerCredentials.providerId, providerCredentials.name],
            set: {
              encryptedKey: encrypted.ciphertext,
              keyFingerprint: encrypted.fingerprint,
              updatedAt: new Date(),
            },
          })
      );
      return { ok: true, fingerprint: encrypted.fingerprint };
    } catch (error) {
      logger.error('保存凭据失败', error);
      return { ok: false, error: '保存失败' };
    }
  }
}

export const providerRepository = new ProviderRepository();
