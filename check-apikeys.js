const { Pool } = require('./node_modules/pg');

async function check() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:dhj5316@localhost:5432/dunhuang'
  });
  
  const configs = await pool.query("SELECT id, provider, enabled, length(api_key) as key_len FROM api_configs");
  console.log('API Configs in DB:');
  configs.rows.forEach(r => console.log(' ', r.id, 'provider:', r.provider, 'enabled:', r.enabled, 'key_len:', r.key_len));
  
  await pool.end();
}

check().catch(e => console.error('Error:', e.message));
