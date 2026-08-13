/**
 * 数据库连接配置
 * 支持 PostgreSQL / Supabase
 *
 * 连接池调优（Phase 9.14）：
 * - max: 默认 30（之前 10 是瓶颈，500 并发 P99=611ms）
 * - min: 5（保持热连接，减少冷启动延迟）
 * - idleTimeoutMillis: 30s
 * - connectionTimeoutMillis: 5s（连接超时上限）
 *
 * Phase 9.16 修复：
 * - listen Pool 'error' / 'connect' 事件，drizzle 卡住时输出真实错误
 *
 * 环境变量覆盖：
 * - DATABASE_POOL_MAX: 自定义最大连接数
 * - DATABASE_POOL_MIN: 自定义最小热连接数
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

// 数据库连接配置
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || '';

if (!databaseUrl) {
  console.warn('⚠️ DATABASE_URL 未配置，数据库功能将不可用');
}

const POOL_MAX = parseInt(process.env.DATABASE_POOL_MAX || '30', 10);
const POOL_MIN = parseInt(process.env.DATABASE_POOL_MIN || '5', 10);

// 仅当有有效 DATABASE_URL 时才创建连接池
// 注意: node-postgres pg.Pool 不支持 lazyConnect 选项（不同于 ioredis）
//       Phase 9.16 修复: 用 connectionTimeoutMillis 控制单次连接超时
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: POOL_MAX,
      min: POOL_MIN,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: false,
    })
  : null;

console.log(`[db] 连接池配置: max=${POOL_MAX}, min=${POOL_MIN}`);

// Phase 9.16 · PG Pool 详细事件日志（定位 drizzle 卡住的真实原因）
if (pool) {
  pool.on('error', (err: Error) => {
    console.error('[db:pool] 连接错误:', err.message, err.stack);
  });
  pool.on('connect', () => {
    console.log('[db:pool] 新连接建立');
  });
  pool.on('remove', () => {
    console.log('[db:pool] 连接释放');
  });
  // 预热连接（解决首请求延迟 + 触发 drizzle 真实初始化）
  pool.query('SELECT 1').then(() => {
    console.log('[db:pool] 预热连接成功');
  }).catch((err: Error) => {
    console.warn('[db:pool] 预热失败:', err.message);
  });
}

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