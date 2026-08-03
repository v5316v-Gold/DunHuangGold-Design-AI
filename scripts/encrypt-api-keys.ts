/**
 * API Key 明文回填加密脚本
 *
 * 用途：将 api_configs 表中历史明文 API Key 加密为 AES-256-GCM 密文
 *
 * 特性：
 *   - dry-run 模式：只扫描不写入，输出预估报告
 *   - 跳过已加密记录：能正常解密的内容视为已加密，跳过
 *   - 执行前备份提示：默认要求确认（--yes 跳过）
 *   - 执行后输出报告：统计总数/已加密/跳过/失败
 *   - 安全：严禁打印完整 Key，只输出 mask 后（前4后4）形式
 *
 * 用法：
 *   # 预演（不写入）
 *   DATABASE_URL=... API_KEY_ENCRYPTION_KEY=<32字节hex> npx tsx scripts/encrypt-api-keys.ts --dry-run
 *
 *   # 正式执行（需确认）
 *   DATABASE_URL=... API_KEY_ENCRYPTION_KEY=<32字节hex> npx tsx scripts/encrypt-api-keys.ts
 *
 *   # 正式执行（跳过确认）
 *   DATABASE_URL=... API_KEY_ENCRYPTION_KEY=<32字节hex> npx tsx scripts/encrypt-api-keys.ts --yes
 */

import { createDecipheriv } from 'crypto';
import { Pool } from 'pg';
import 'dotenv/config';

// ==================== 配置 ====================

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_CONFIRM = process.argv.includes('--yes');

// 加密密钥（32 字节 hex）
function getEncryptionKey(): Buffer {
  const key = Buffer.from(process.env.API_KEY_ENCRYPTION_KEY || '', 'hex');
  if (key.length !== 32) {
    console.error('❌ API_KEY_ENCRYPTION_KEY 必须是 32 字节 hex（64 个十六进制字符）');
    console.error('   生成方式: openssl rand -hex 32');
    process.exit(1);
  }
  return key;
}

// ==================== 加解密 ====================

/** 加密 API Key（AES-256-GCM，iv(12) + tag(16) + data） */
function encryptApiKey(plain: string): string {
  const { createCipheriv, randomBytes } = require('crypto') as typeof import('crypto');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

/** 尝试解密：成功 = 已加密；失败 = 明文或损坏 */
function tryDecrypt(value: string): { ok: boolean; plain?: string } {
  try {
    const payload = Buffer.from(value, 'base64');
    if (payload.length < 28) return { ok: false }; // 太短不可能是密文
    const decipher = createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      payload.subarray(0, 12)
    );
    decipher.setAuthTag(payload.subarray(12, 28));
    const plain = Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
    return { ok: true, plain };
  } catch {
    return { ok: false };
  }
}

/** 脱敏显示：只显示前4后4，绝不显示完整 Key */
function mask(value: string): string {
  if (!value) return '(空)';
  if (value.length <= 8) return '****';
  return `${value.slice(0, 4)}****${value.slice(-4)}`;
}

// ==================== 主流程 ====================

async function main() {
  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL 未配置');
    process.exit(1);
  }

  // 确保加密密钥有效（提前 fail-fast）
  getEncryptionKey();

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });

  console.log('========================================');
  console.log('  API Key 明文回填加密脚本');
  console.log(`  模式: ${DRY_RUN ? 'DRY-RUN（不写入）' : '执行'}`);
  console.log('========================================\n');

  // 1. 查询所有 API 配置
  const { rows } = await pool.query(
    `SELECT id, name, provider, api_key, enabled
     FROM api_configs
     WHERE api_key IS NOT NULL AND api_key != ''`
  );

  if (rows.length === 0) {
    console.log('✅ 没有需要处理的 API Key 记录');
    await pool.end();
    return;
  }

  console.log(`📊 找到 ${rows.length} 条含 API Key 的记录\n`);

  // 2. 分类
  const toEncrypt: typeof rows = []; // 明文待加密
  const alreadyEncrypted: typeof rows = []; // 已加密跳过
  const failed: typeof rows = []; // 无法处理

  for (const row of rows) {
    const result = tryDecrypt(row.api_key);
    if (result.ok) {
      alreadyEncrypted.push(row);
    } else {
      // 无法解密：可能是明文，也可能是损坏的密文
      // 判断：如果看起来像 base64 且长度≥28，可能是损坏密文；否则视为明文
      const looksBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(row.api_key);
      if (looksBase64 && row.api_key.length >= 28) {
        // 可能是损坏的密文，保守处理：列为失败，不覆盖
        failed.push(row);
      } else {
        toEncrypt.push(row);
      }
    }
  }

  // 3. 预览报告
  console.log('--- 扫描结果 ---');
  console.log(`  待加密（明文）: ${toEncrypt.length} 条`);
  console.log(`  已加密（跳过）: ${alreadyEncrypted.length} 条`);
  console.log(`  无法判断（跳过）: ${failed.length} 条`);

  if (toEncrypt.length > 0) {
    console.log('\n--- 待加密明细（脱敏） ---');
    for (const row of toEncrypt) {
      console.log(
        `  [${row.id}] ${row.name || row.provider || '未知'} | provider=${row.provider || '-'} | ` +
          `当前: ${mask(row.api_key)} | 将加密为: ${mask(encryptApiKey(row.api_key))}`
      );
    }
  }

  // 4. dry-run 结束
  if (DRY_RUN) {
    console.log('\n🔍 DRY-RUN 模式：未写入任何数据');
    await pool.end();
    return;
  }

  // 5. 备份提示 + 确认
  console.log('\n⚠️  执行前请确认已备份数据库：');
  console.log('    pg_dump -h <host> -U <user> -d <dbname> > backup.sql');
  if (!SKIP_CONFIRM) {
    console.log('\n输入 yes 继续，或 Ctrl+C 取消:');
    // 读取 stdin
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise<string>((resolve) =>
      rl.question('> ', resolve)
    );
    rl.close();
    if (answer.trim().toLowerCase() !== 'yes') {
      console.log('❌ 已取消，未写入任何数据');
      await pool.end();
      return;
    }
  }

  // 6. 执行加密回填
  console.log('\n🔐 开始加密回填...');
  let success = 0;
  const failures: Array<{ id: string; name: string; reason: string }> = [];

  for (const row of toEncrypt) {
    try {
      const encrypted = encryptApiKey(row.api_key);
      await pool.query('UPDATE api_configs SET api_key = $1, updated_at = NOW() WHERE id = $2', [
        encrypted,
        row.id,
      ]);
      success++;
      // 只打印脱敏确认，不打印 Key
      console.log(`  ✅ [${row.id}] ${row.name || row.provider || '未知'} 已加密 → ${mask(encrypted)}`);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      failures.push({ id: row.id, name: row.name || row.provider || '未知', reason });
      console.error(`  ❌ [${row.id}] 加密失败: ${reason}`);
    }
  }

  // 7. 最终报告
  console.log('\n========================================');
  console.log('  执行报告');
  console.log('========================================');
  console.log(`  总记录: ${rows.length}`);
  console.log(`  已加密（本次）: ${success}`);
  console.log(`  已加密（跳过）: ${alreadyEncrypted.length}`);
  console.log(`  失败: ${failures.length}`);
  console.log(`  无法判断: ${failed.length}`);

  if (failures.length > 0) {
    console.log('\n--- 失败明细 ---');
    for (const f of failures) {
      console.log(`  ❌ [${f.id}] ${f.name}: ${f.reason}`);
    }
  }

  if (failed.length > 0) {
    console.log('\n⚠️  以下记录疑似损坏密文，未自动处理，请人工检查:');
    for (const row of failed) {
      console.log(`  [${row.id}] ${row.name || row.provider || '未知'} (${mask(row.api_key)})`);
    }
  }

  await pool.end();
  console.log('\n✅ 完成');
}

main().catch((err) => {
  console.error('❌ 脚本执行失败:', err instanceof Error ? err.message : err);
  process.exit(1);
});
