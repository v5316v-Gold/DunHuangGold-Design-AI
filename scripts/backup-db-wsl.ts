/**
 * Phase 9.6 · 数据库备份（WSL docker 通道）
 * 用 wsl docker exec 执行 pg_dump
 * 用法: npx tsx scripts/backup-db-wsl.ts [保留天数=7]
 */
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const RETENTION_DAYS = parseInt(process.argv[2] || '7', 10);

function wsl(cmd: string): string {
  return execSync(`wsl -d Ubuntu -- bash -c "${cmd.replace(/"/g, '\\"')}"`, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 200,
  });
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未配置');
  const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (!m) throw new Error('DATABASE_URL 格式错误');
  const [, user, , , , db] = m;

  const backupDir = path.resolve(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `dunhuang-${db}-${ts}.sql`;
  const filepath = path.join(backupDir, filename);

  console.log(`🔗 备份 ${db} → ${filepath}`);

  try {
    // 找实际 PG 容器名
    const containers = wsl('docker ps --format "{{.Names}}"');
    const pgContainer = containers
      .split('\n')
      .find((n) => /postgres|postgresql/i.test(n.trim()));
    if (!pgContainer) throw new Error('未找到 PG 容器');

    console.log(`📦 容器: ${pgContainer.trim()}`);
    const dump = wsl(
      `docker exec ${pgContainer.trim()} pg_dump -U ${user} -d ${db} --no-owner --no-acl`
    );
    fs.writeFileSync(filepath, dump);
    console.log(`✅ 备份完成: ${filename} (${(dump.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error('❌ 备份失败:', (err as Error).message);
    process.exit(1);
  }

  // 清理旧备份
  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.sql'));
  const now = Date.now();
  let removed = 0;
  for (const f of files) {
    if (f === filename) continue;
    const fp = path.join(backupDir, f);
    const age = (now - fs.statSync(fp).mtimeMs) / 86400000;
    if (age > RETENTION_DAYS) {
      fs.unlinkSync(fp);
      removed++;
    }
  }
  if (removed > 0) console.log(`🧹 清理 ${removed} 个过期备份`);
  console.log(`\n📂 备份目录: ${backupDir}`);
}

main().catch((e) => { console.error('❌ 失败:', e); process.exit(1); });
