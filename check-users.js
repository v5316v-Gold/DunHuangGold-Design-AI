const { Pool } = require('./node_modules/pg');

async function check() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres:dhj5316@localhost:5432/dunhuang'
  });
  
  // Check users table structure
  const cols = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position");
  console.log('Users table columns:');
  cols.rows.forEach(r => console.log(' ', r.column_name));
  
  // Check if admin exists
  const admin = await pool.query("SELECT id, email FROM users WHERE email = 'admin@dunhuang.com'");
  console.log('Admin exists:', admin.rows.length > 0, admin.rows[0]);
  
  await pool.end();
}

check().catch(e => console.error('Error:', e.message));
