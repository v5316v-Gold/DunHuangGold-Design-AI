/**
 * W3-E 验收：LoRA Manager 端到端（DB 直连）
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未配置');

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // 1. 创建测试 LoRA
    console.log('📝 创建测试 LoRA...');
    const testLoRA = {
      name: 'spike-test-lora',
      triggerWords: ['test', 'spike'],
      filePath: '/tmp/test-lora.safetensors',
      scope: ['text2img', 'refine'],
      fileSize: 1024,
    };

    const { rows: existing } = await client.query(
      `SELECT id FROM loras WHERE name = $1`,
      [testLoRA.name]
    );

    if (existing[0]) {
      console.log('  → 测试 LoRA 已存在，删除重建');
      await client.query(`DELETE FROM loras WHERE name = $1`, [testLoRA.name]);
    }

    const { rows: created } = await client.query(
      `INSERT INTO loras (name, trigger_words, file_path, scope, file_size, enabled, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, true, NULL)
       RETURNING id, enabled`,
      [
        testLoRA.name,
        testLoRA.triggerWords,
        testLoRA.filePath,
        testLoRA.scope,
        testLoRA.fileSize,
      ]
    );
    console.log('  ✅ 创建:', created[0]);
    const loraId = created[0].id;

    // 2. 查 scope 匹配
    console.log('\n🔍 查 text2img scope 匹配的 LoRA...');
    const { rows: matched } = await client.query(
      `SELECT name, trigger_words, scope FROM loras
       WHERE enabled = true AND scope @> ARRAY['text2img']::text[]`,
      []
    );
    console.log(`  ✅ 匹配 ${matched.length} 条`);
    if (matched.length > 0) {
      console.log('  示例:', matched[0].name, matched[0].trigger_words);
    }

    // 3. 切换启用状态
    console.log('\n🔄 切换启用状态...');
    await client.query(`UPDATE loras SET enabled = false WHERE id = $1`, [loraId]);
    const { rows: updated } = await client.query(
      `SELECT enabled FROM loras WHERE id = $1`,
      [loraId]
    );
    console.log('  ✅ 当前状态:', updated[0]);

    // 4. 删除测试数据
    console.log('\n🧹 清理测试数据...');
    await client.query(`DELETE FROM loras WHERE id = $1`, [loraId]);
    console.log('  ✅ 已删除');

    console.log('\n🎉 W3-E 验收通过');
  } catch (err) {
    console.error('❌ 失败:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();