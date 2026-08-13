// worker 容器内 db 测试
const { Client } = require('pg');
(async () => {
  const c = new Client({ host: 'localhost', port: 5432, user: 'dunhuang1', password: 'dunhuang2026', database: 'dunhuang' });
  await c.connect();
  const r = await c.query("SELECT id, name, default_executor, fallback_executors FROM features WHERE id = $1 LIMIT 1", ['relief']);
  console.log('relief row:', JSON.stringify(r.rows[0]));
  await c.end();
})().catch(e => console.error('FAIL:', e.message));
