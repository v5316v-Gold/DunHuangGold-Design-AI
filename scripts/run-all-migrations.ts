/**
 * 统一数据库迁移执行器（003-008）
 * 幂等：每个迁移 SQL 都带 IF NOT EXISTS
 *
 * 运行：npx tsx scripts/run-all-migrations.ts
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { readFileSync, readdirSync } from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'src/db/migrations');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未配置');

  const client = new Client({ connectionString: url });
  await client.connect();
  console.log('🔗 已连接数据库');

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();  // 按文件名排序（003 < 004 < ...）

  console.log(`📋 发现 ${files.length} 个迁移文件:\n`);

  for (const file of files) {
    const content = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`▶️  执行 ${file} ...`);

    try {
      await client.query(content);
      console.log(`  ✅ ${file} 完成`);
    } catch (err) {
      // 已存在的表/列会报 42P07/42701，但 IF NOT EXISTS 通常不会
      // 记录错误但继续（幂等容错）
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log(`  ⚠️ ${file} 已应用过（幂等跳过）`);
      } else {
        console.error(`  ❌ ${file} 失败: ${msg.substring(0, 200)}`);
      }
    }
  }

  // 验证关键表
  console.log('\n🔍 验证关键表:');
  const tables = [
    'users', 'works', 'tasks', 'favorites', 'power_logs',
    'power_transactions', 'api_configs', 'comfyui_configs',
    'comfyui_connections', 'workflows', 'workflow_templates', 'loras',
    'features', 'audit_logs', 'system_settings', 'translate_settings',
    'prompt_rules', 'app_settings', 'health_check',
  ];
  for (const t of tables) {
    const r = await client.query(
      `SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename=$1) AS exists`,
      [t]
    );
    console.log(`  ${r.rows[0].exists ? '✅' : '❌'} ${t}`);
  }

  await client.end();
  console.log('\n🎉 迁移执行完成');
}

main().catch((err) => {
  console.error('❌ 迁移失败:', err);
  process.exit(1);
});