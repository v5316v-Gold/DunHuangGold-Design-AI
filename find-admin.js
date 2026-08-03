const { db } = require('./src/storage/database/db');
const { users } = require('./src/storage/database/shared/schema');
const { eq } = require('drizzle-orm');

async function main() {
  const result = await db.select().from(users).where(eq(users.role, 'admin')).limit(5);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
