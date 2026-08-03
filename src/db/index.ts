/**
 * 数据库连接配置
 * 支持 PostgreSQL / Supabase
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// 数据库连接配置
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || '';

if (!databaseUrl) {
  console.warn('⚠️ DATABASE_URL 未配置，数据库功能将不可用');
}

// 仅当有有效 DATABASE_URL 时才创建连接池
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: false,
    })
  : null;

// 创建 Drizzle 实例（仅在有连接池时）
// server-only: API routes 总是通过 dynamic=force-dynamic 访问，不会有 null 问题
export const db = pool ? drizzle(pool, { schema }) : null;

// 健康检查
export async function checkDatabaseConnection(): Promise<boolean> {
  if (!db || !pool) return false;

  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('数据库连接失败:', error);
    return false;
  }
}

// 优雅关闭
export async function closeDatabaseConnection(): Promise<void> {
  if (pool) await pool.end();
}

export { schema };
