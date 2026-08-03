import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './src/storage/database/shared/schema';
import { eq } from 'drizzle-orm';

const { Pool } = pg;
const pool = new Pool({
  connectionString: 'postgresql://dunhuang_user:dunhuang2024@localhost:5432/dunhuang',
  max: 5,
  ssl: false,
});
const db = drizzle(pool, { schema });
const { users } = schema;

(async () => {
  const result = await db.select().from(users).where(eq(users.role, 'admin')).limit(5);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})();
