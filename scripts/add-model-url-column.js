/**
 * 给 artworks 表添加 model_url 列
 */
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://dunhuang_user:dunhuang2024@localhost:5432/dunhuang'
  });
  await client.connect();

  // 检查列是否存在
  const check = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'model_url'
  `);

  if (check.rows.length > 0) {
    console.log('✅ model_url 列已存在');
  } else {
    await client.query(`
      ALTER TABLE artworks ADD COLUMN model_url TEXT
    `);
    console.log('✅ 已添加 model_url 列');
  }

  // 同时添加 video_url 列（方便以后扩展）
  const check2 = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'artworks' AND column_name = 'video_url'
  `);

  if (check2.rows.length === 0) {
    await client.query(`
      ALTER TABLE artworks ADD COLUMN video_url TEXT
    `);
    console.log('✅ 已添加 video_url 列');
  } else {
    console.log('✅ video_url 列已存在');
  }

  await client.end();
  console.log('完成');
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
