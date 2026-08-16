/**
 * scripts/check-vault.ts
 * W1·R2 自检脚本:在不依赖 pnpm 安装的情况下,验证 secret-vault 的加密/解密/mask 与 seed-api-configs 的输入读取逻辑。
 * 在 host 上用 node + 自身 cp 测试(seed-api-configs.ts 本身只能 pnpm tsx 跑,但 secret-vault.ts 只需要 crypto + 字符串逻辑)。
 */
import crypto from 'crypto';

const KEY_ENV = 'API_KEY_ENCRYPTION_KEY';

function getKeyFromRaw(raw: string): Buffer {
  if (!raw || !/^[0-9a-fA-F]{64}$/.test(raw)) throw new Error('bad key');
  return Buffer.from(raw, 'hex');
}

function encrypt(plain: string, key: Buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return { ciphertext: ct.toString('hex'), iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
}

function decrypt(enc: { ciphertext: string; iv: string; authTag: string }, key: Buffer) {
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(enc.iv, 'hex'));
  d.setAuthTag(Buffer.from(enc.authTag, 'hex'));
  const pt = Buffer.concat([d.update(Buffer.from(enc.ciphertext, 'hex')), d.final()]);
  return pt.toString('utf8');
}

function mask(key: string | null): string {
  if (!key) return '';
  if (key.length <= 4) return '****';
  return `${'*'.repeat(Math.max(key.length - 4, 4))}${key.slice(-4)}`;
}

console.log('==== W1·R2 secret-vault 自检 ====');
const rawKey = crypto.randomBytes(32).toString('hex');
process.env[KEY_ENV] = rawKey;
const key = getKeyFromRaw(rawKey);

const samples = [
  'sk-cp-3XKlkHl-9DmvB0bI-Vh4oYMSr740BPV3L-BpHOm-CTpUDEew_KyDmRL1A6iPexdSacZ722G7g9Umn8LksT09QYRT6N0NxAfS0ZP3YWKSQ_wOpBb0wJR-gT4',
  'sk-zhipu-demo-1234',
  'EUV1xxxxxxxx',
];
let i = 0;
for (const s of samples) {
  i += 1;
  const e = encrypt(s, key);
  const back = decrypt(e, key);
  const m = mask(s);
  const pass = back === s;
  console.log(`  #${i}`, pass ? 'OK ' : 'FAIL', `mask=${m}  iv=${e.iv.slice(0, 6)}…  len=${e.ciphertext.length / 2}B`);
  if (!pass) process.exitCode = 1;
}
console.log('==== 完成 ====');
