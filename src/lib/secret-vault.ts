/**
 * Secret Vault（密钥保险箱）
 *
 * W1 阶段:把原本明文存储的 apiConfigs.apiKey 改为 AES-256-GCM 加密备份至
 * api_config_secrets,主页 apiKey 字段仅保留 "lit 后 4 位",真正解密统一过
 * 这里。系统启动时若检测到 apiConfigs.apiKey 明文但 secret 缺,自动迁移。
 *
 * 设计:
 *  - 密钥来源 API_KEY_ENCRYPTION_KEY(64 hex)
 *  - 算法 AES-256-GCM,iv 12 byte 随机,带 auth_tag
 *  - storage: ciphertext/iv/auth_tag 全部 hex
 */
import crypto from 'crypto';

const KEY_ENV = 'API_KEY_ENCRYPTION_KEY';

let cachedKey: Buffer | null = null;
function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env[KEY_ENV];
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(`${KEY_ENV} 必须为 64 位 hex 字符串`);
  }
  cachedKey = Buffer.from(raw, 'hex');
  return cachedKey;
}

export interface EncryptedField {
  ciphertext: string; // hex
  iv: string; // hex
  authTag: string; // hex
}

export function encryptSecret(plain: string): EncryptedField {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ct.toString('hex'),
    iv: iv.toString('hex'),
    authTag: tag.toString('hex'),
  };
}

export function decryptSecret(field: EncryptedField): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(field.iv, 'hex'));
  decipher.setAuthTag(Buffer.from(field.authTag, 'hex'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(field.ciphertext, 'hex')),
    decipher.final(),
  ]);
  return pt.toString('utf8');
}

/** 屏蔽 API Key 前段,只保留后 4 位,用于前端展示 */
export function maskApiKey(key: string | null | undefined): string {
  if (!key) return '';
  if (key.length <= 4) return '****';
  return `${'*'.repeat(Math.max(key.length - 4, 4))}${key.slice(-4)}`;
}

/**
 * 检查现有 .env + api_configs 是否有明文 key 未入库；如有,提示先 seed 一遍
 */
export function hasEncryptionKey(): boolean {
  return /^[0-9a-fA-F]{64}$/.test(process.env[KEY_ENV] || '');
}
