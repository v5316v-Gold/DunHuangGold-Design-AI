/**
 * Phase 9.6 · 数据库备份脚本
 *
 * 每日备份 PostgreSQL → 压缩 SQL 文件，保留 N 天
 * 用法: npx tsx scripts/backup-db.ts [保留天数=7]
 *
 * 备份内容: 全库 pg_dump（schema + data）
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RETENTION_DAYS = parseInt(process.argv[2] || '7', 10);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未配置');

  // 解析 URL
  const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!m) throw new Error('DATABASE_URL 格式错误');
  const [, user, pass, host, port, db] = m;

  const backupDir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `dunhuang-${db}-${ts}.sql`;
  const filepath = path.join(backupDir, filename);

  console.log(`🔗 备份 ${db}@${host}:${port} → ${filepath}`);

  // 用 pg_dump（走 docker exec 1Panel 容器，或用本地 pg_dump）
  let cmd: string;
  if (process.env.BACKUP_VIA_DOCKER === '1') {
    cmd = `docker exec postgresql-DHgold pg_dump -U ${user} -d ${db} --no-owner --no-acl`;
  } else {
    // 本地 pg_dump 可能没有；尝试用 node pg 的 COPY
    cmd = `pg_dump -h ${host} -p ${port} -U ${user} -d ${db} --no-owner --no-acl`;
  }

  try {
    const dump = execSync(cmd, {
      env: { ...process.env, PGPASSWORD: pass },
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 100, // 100MB
    });
    fs.writeFileSync(filepath, dump);
    console.log(`✅ 备份完成: ${filename} (${(dump.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    // 若 pg_dump 不可用，降级用 node pg 全表导出
    console.warn('⚠️ pg_dump 不可用，降级到 node 导出:', (err as Error).message);
    await nodeBackup(url, filepath);
  }

  // 清理旧备份
  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.sql'));
  const now = Date.now();
  let removed = 0;
  for (const f of files) {
    const fp = path.join(backupDir, f);
    const age = (now - fs.statSync(fp).mtimeMs) / 86400000;
    if (age > RETENTION_DAYS) {
      fs.unlinkSync(fp);
      removed++;
    }
  }
  if (removed > 0) console.log(`🧹 清理 ${removed} 个过期备份（>${RETENTION_DAYS} 天）`);

  console.log(`\n📂 备份目录: ${backupDir}`);
}

/**
 * 降级方案：用 node pg 导出所有表（无 pg_dump 时）
 */
async function nodeBackup(url: string, filepath: string) {
  const { Client } = await import('pg');
  const client = new Client({ connectionString: url });
  await client.connect();

  const tables = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );

  let dump = `-- Dunhuang DB backup (node fallback)\n-- ${new Date().toISOString()}\n\n`;

  for (const { tablename } of tables.rows) {
    const rows = await client.query(`SELECT * FROM ${tablename}`);
    dump += `-- Table: ${tablename} (${rows.rows.length} rows)\n`;
    for (const row of rows.rows) {
      const cols = Object.entries(row).map(([k, v]) => {
        if (v === null) return 'NULL';
        if (typeof v === 'number') return String(v);
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      dump += `INSERT INTO ${tablename} VALUES (${cols.join(', ')});\n`;
    }
    dump += '\n';
  }

  fs.writeFileSync(filepath, dump);
  console.log(`✅ 降级备份完成: ${(dump.length / 1024).toFixed(1)} KB`);
  await client.end();
}

main().catch((e) => { console.error('❌ 备份失败:', e); process.exit(1); });
