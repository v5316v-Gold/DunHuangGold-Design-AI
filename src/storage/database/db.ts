import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './shared/schema';
import { sql } from 'drizzle-orm';

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL || '';

// 连接状态追踪
let connectionState: 'unknown' | 'connected' | 'disconnected' = 'unknown';
let lastCheckTime = 0;
const CHECK_INTERVAL = 5000; // 5秒内不重复检查

// 仅当有有效 DATABASE_URL 时才创建连接池
const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000, // 5秒超时
      ssl: false,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      // 重试配置
      statement_timeout: 30000,
    })
  : null;

// 创建 Drizzle 实例（仅在有连接池时）
export const db = pool ? drizzle(pool, { schema }) : null;

/**
 * 检查数据库是否可用（带缓存）
 * 避免频繁执行连接检测查询
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  if (!db) return false;
  
  const now = Date.now();
  
  // 如果已知是已连接状态，且在检查间隔内，跳过检测
  if (connectionState === 'connected' && (now - lastCheckTime) < CHECK_INTERVAL) {
    return true;
  }
  
  // 如果已知是断开状态，等待后再试
  if (connectionState === 'disconnected' && (now - lastCheckTime) < 3000) {
    return false;
  }
  
  lastCheckTime = now;
  
  try {
    // 使用简单查询测试连接
    await db.execute(sql`SELECT 1`);
    connectionState = 'connected';
    return true;
  } catch (error) {
    console.warn('[DB] PostgreSQL 连接失败:', error instanceof Error ? error.message : String(error));
    connectionState = 'disconnected';
    return false;
  }
}

/**
 * 重试执行数据库操作
 * @param operation 要执行的操作
 * @param maxRetries 最大重试次数
 * @param delayMs 重试间隔（毫秒）
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[DB] 操作失败 (尝试 ${attempt}/${maxRetries}):`, lastError.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  
  throw lastError || new Error('数据库操作失败');
}

// 导出 schema
export * from './shared/schema';
