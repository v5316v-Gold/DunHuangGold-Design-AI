/**
 * W3-B 迁移：创建 loras 表
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SQL = `
CREATE TABLE IF NOT EXISTS loras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  trigger_words TEXT[] NOT NULL DEFAULT '{}',
  file_path VARCHAR(500) NOT NULL,
  file_hash VARCHAR(64),
  file_size BIGINT,
  base_model VARCHAR(100),
  scope TEXT[] NOT NULL DEFAULT '{}',
  preview_image VARCHAR(500),
  enabled BOOLEAN DEFAULT true NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loras_enabled ON loras(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_loras_scope ON loras USING GIN(scope);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未配置');

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(SQL);
    console.log('✅ loras 表已创建');

    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'loras'
      ORDER BY ordinal_position
    `);
    console.log(`📊 字段数: ${cols.rows.length}`);
    for (const r of cols.rows) {
      console.log(`  - ${r.column_name}: ${r.data_type}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ 失败:', err);
  process.exit(1);
});