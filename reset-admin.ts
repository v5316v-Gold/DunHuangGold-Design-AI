import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { eq } from 'drizzle-orm';
import * as schema from './src/storage/database/shared/schema';
import { hash } from 'bcryptjs';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://dunhuang_user:dunhuang2024@localhost:5432/dunhuang',
  max: 5,
  ssl: false,
});
const db = drizzle(pool, { schema });
const { users } = schema;

(async () => {
  const newPassword = 'admin123';
  const newHash = await hash(newPassword, 10);
  console.log('New hash:', newHash);

  await db.update(users).set({ password_hash: newHash }).where(eq(users.email, 'admin@dunhuang.com'));
  console.log('✅ Password updated for admin@dunhuang.com');

  const result = await db.select().from(users).where(eq(users.email, 'admin@dunhuang.com'));
  console.log(JSON.stringify(result, null, 2));

  process.exit(0);
})();
