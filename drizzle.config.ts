import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './src/db/schema/_tables.ts',
  out: './src/storage/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://dunhuang1:dunhuang2026@localhost:5432/dunhuang',
  },
  verbose: true,
  strict: true,
});
