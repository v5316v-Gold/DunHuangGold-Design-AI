import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function getEncryptionKey(): Buffer {
  const key = Buffer.from(process.env.API_KEY_ENCRYPTION_KEY || '', 'hex');
  if (key.length !== 32) throw new Error('API_KEY_ENCRYPTION_KEY 必须是 32 字节 hex');
  return key;
}
export function encryptApiKey(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
export function decryptApiKey(value: string): string {
  const payload = Buffer.from(value, 'base64');
  if (payload.length < 28) throw new Error('无效的加密 API Key');
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
}
export function maskApiKey(value: string): string {
  return value.length <= 8 ? '****' : `${value.slice(0, 4)}****${value.slice(-4)}`;
}
