const { Pool } = require('./node_modules/pg');
const bcrypt = require('./node_modules/bcryptjs');

async function reset() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:dhj5316@localhost:5432/dunhuang'
  });
  
  const hash = await bcrypt.hash('admin123', 10);
  console.log('New hash:', hash.substring(0, 20) + '...');
  
  const result = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE email = $2',
    [hash, 'admin@dunhuang.com']
  );
  
  console.log('Rows affected:', result.rowCount);
  await pool.end();
  console.log('Done');
}

reset().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
