/**
 * W2 Step 4 迁移执行：创建 workflow_templates 表
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SQL = `
CREATE TABLE IF NOT EXISTS workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  service_type VARCHAR(30) NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  workflow_json JSONB NOT NULL,
  input_schema JSONB,
  comfyui_version VARCHAR(20),
  required_custom_nodes TEXT[] DEFAULT '{}',
  enabled BOOLEAN DEFAULT true NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_templates_service
  ON workflow_templates(service_type, enabled)
  WHERE enabled = true;
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未配置');

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(SQL);
    console.log('✅ workflow_templates 表已创建');

    const cols = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'workflow_templates'
      ORDER BY ordinal_position
    `);
    console.log(`📊 字段数: ${cols.rows.length}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ 失败:', err);
  process.exit(1);
});