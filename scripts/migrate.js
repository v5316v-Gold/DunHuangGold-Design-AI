#!/usr/bin/env node
/**
 * P0-1 · 数据库迁移脚本（纯 node，standalone 兼容）
 *
 * 为什么不用 drizzle-kit / psql：
 *   - Docker runner 是 next/standalone 最小镜像，无 node_modules/.bin、无 psql
 *   - standalone node_modules 内含 pg，可直接执行 SQL
 *
 * 迁移内容（顺序执行，全部幂等）：
 *   1. drizzle journal 迁移（src/storage/database/migrations/0000_*.sql + meta journal）
 *      —— 若不存在则跳过（旧环境）
 *   2. 手写 SQL 迁移（src/db/migrations/003~008，全部 IF NOT EXISTS）
 *
 * 用法：
 *   node scripts/migrate.js                # 读取 DATABASE_URL 环境变量
 *   DATABASE_URL=... node scripts/migrate.js
 *
 * 退出码：0=成功 / 1=失败（entrypoint 依赖此码阻断启动）
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL 未设置，跳过迁移');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  console.log('✅ 已连接数据库');

  const applied = [];
  const skipped = [];

  // ========== 1. drizzle journal 迁移 ==========
  const drizzleDir = path.join(ROOT, 'src', 'storage', 'database', 'migrations');
  const manualDir = path.join(ROOT, 'src', 'db', 'migrations');

  // drizzle 迁移：按 meta/_journal.json 顺序执行
  try {
    const journalPath = path.join(drizzleDir, 'meta', '_journal.json');
    if (fs.existsSync(journalPath)) {
      const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
      const entries = (journal.entries || []).map((e) => e.tag || e.idx);
      for (const tag of entries) {
        // tag 形如 '0000_add_models_center'，找对应 sql
        const sqlFile = path.join(drizzleDir, `${tag}.sql`);
        if (fs.existsSync(sqlFile)) {
          const sql = fs.readFileSync(sqlFile, 'utf8');
          await client.query(sql);
          applied.push(`drizzle/${path.basename(sqlFile)}`);
        }
      }
    } else {
      skipped.push('drizzle journal（不存在）');
    }
  } catch (e) {
    console.error(`❌ drizzle 迁移失败: ${e.message}`);
    // drizzle 迁移失败不阻断（0000 可能已应用，ALTER 类幂等）
    skipped.push('drizzle journal（执行异常，跳过）');
  }

  // ========== 2. 手写 SQL 迁移（003~008，幂等） ==========
  if (fs.existsSync(manualDir)) {
    const files = fs
      .readdirSync(manualDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(manualDir, f), 'utf8');
      try {
        await client.query(sql);
        applied.push(f);
      } catch (e) {
        console.error(`❌ 迁移失败: ${f}: ${e.message}`);
        process.exit(1);
      }
    }
  }

  await client.end();

  console.log('\n=== 迁移结果 ===');
  applied.forEach((a) => console.log(`  ✅ ${a}`));
  skipped.forEach((s) => console.log(`  ⏭️  ${s}`));
  console.log(`\n✅ 数据库迁移完成（应用 ${applied.length} / 跳过 ${skipped.length}）`);
}

main().catch((e) => {
  console.error('❌ 迁移失败:', e.message);
  process.exit(1);
});
