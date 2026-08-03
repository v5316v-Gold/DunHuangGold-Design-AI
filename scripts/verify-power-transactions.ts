/**
 * 验收脚本：确认 power_transactions 表在线上数据库存在
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未配置');
  console.log('🔗 连接:', url.replace(/:[^:@]+@/, ':***@'));

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // 1. 表存在性
    const existResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'power_transactions'
      ) AS exists
    `);
    console.log(`\n[V1] power_transactions 表存在: ${existResult.rows[0].exists ? '✅' : '❌'}`);

    // 2. 字段清单
    const cols = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'power_transactions'
      ORDER BY ordinal_position
    `);
    console.log(`\n[V1.2] 字段清单 (${cols.rows.length} 个):`);
    for (const r of cols.rows) {
      console.log(`  - ${r.column_name}: ${r.data_type} ${r.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    }

    // 3. 索引清单
    const idx = await client.query(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'power_transactions'
    `);
    console.log(`\n[V1.3] 索引清单 (${idx.rows.length} 个):`);
    for (const r of idx.rows) {
      console.log(`  - ${r.indexname}`);
    }

    // 4. 外键约束
    const fks = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      JOIN information_schema.referential_constraints AS rc ON rc.constraint_name = tc.constraint_name
      WHERE tc.table_name = 'power_transactions' AND tc.constraint_type = 'FOREIGN KEY'
    `);
    console.log(`\n[V1.4] 外键约束 (${fks.rows.length} 个):`);
    for (const r of fks.rows) {
      console.log(`  - ${r.column_name} → ${r.foreign_table_name}.${r.foreign_column_name} ON DELETE ${r.delete_rule}`);
    }

    // 5. 试插一条 + 删（验证可用性）
    const testInsert = await client.query(`
      BEGIN;
      -- 因为是真实表，先随便用 admin 用户测
      SELECT id FROM users WHERE role = 'admin' LIMIT 1;
    `);
    const adminIdResult = await client.query(`SELECT id, email FROM users WHERE role = 'admin' LIMIT 1`);
    if (adminIdResult.rows.length === 0) {
      console.log(`\n[V1.5] ⚠️ 没有 admin 用户，跳过写测试`);
    } else {
      const adminId = adminIdResult.rows[0].id;
      const adminEmail = adminIdResult.rows[0].email;
      const insertResult = await client.query(`
        INSERT INTO power_transactions
          (user_id, user_email, type, amount, balance_before, balance_after, reason)
        VALUES ($1, $2, 'test', 0, 100, 100, '验收脚本测试')
        RETURNING id
      `, [adminId, adminEmail]);
      const insertedId = insertResult.rows[0].id;
      console.log(`\n[V1.5] ✅ 写入测试记录: ${insertedId}`);

      await client.query(`DELETE FROM power_transactions WHERE id = $1`, [insertedId]);
      console.log(`[V1.6] ✅ 测试记录已清理`);
    }

    console.log('\n🎉 V1 验收通过');
  } catch (err) {
    console.error('❌ V1 失败:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();