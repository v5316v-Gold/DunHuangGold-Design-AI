/**
 * P0-1 应急迁移脚本
 * 直接通过 pg 客户端连接到生产数据库并幂等创建 power_transactions 表
 * 用途：解决线上 42P01 错误（relation "power_transactions" does not exist）
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SQL = `
CREATE TABLE IF NOT EXISTS power_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email VARCHAR(255),
  user_nickname VARCHAR(100),
  type VARCHAR(20) NOT NULL,
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT,
  operator_id UUID,
  operator_email VARCHAR(255),
  related_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pt_user_id ON power_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pt_type ON power_transactions(type);
CREATE INDEX IF NOT EXISTS idx_pt_created_at ON power_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pt_operator_id ON power_transactions(operator_id);

COMMENT ON TABLE power_transactions IS '算力流水表 - 充值/消耗/扣除/退款/奖励';
COMMENT ON COLUMN power_transactions.type IS '交易类型: recharge|consume|deduct|refund|bonus';
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL 未配置');
    process.exit(1);
  }
  console.log('🔗 连接数据库:', url.replace(/:[^:@]+@/, ':***@'));

  const client = new Client({ connectionString: url });
  await client.connect();
  console.log('✅ 已连接');

  try {
    // 检查表是否存在
    const before = await client.query(`
      SELECT EXISTS (
        SELECT FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename = 'power_transactions'
      ) AS exists
    `);
    console.log('📋 power_transactions 表当前存在:', before.rows[0].exists);

    if (before.rows[0].exists) {
      console.log('✅ 表已存在，跳过创建（幂等保护）');
    } else {
      await client.query(SQL);
      console.log('✅ 表已创建');

      const after = await client.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'power_transactions'
        ORDER BY ordinal_position
      `);
      console.log('📊 字段清单:');
      for (const row of after.rows) {
        console.log(`  - ${row.column_name}: ${row.data_type}`);
      }

      const idx = await client.query(`
        SELECT indexname FROM pg_indexes WHERE tablename = 'power_transactions'
      `);
      console.log('🔍 索引清单:');
      for (const row of idx.rows) {
        console.log(`  - ${row.indexname}`);
      }
    }

    console.log('\n🎉 P0-1 修复完成！');
  } catch (err) {
    console.error('❌ 迁移失败:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();