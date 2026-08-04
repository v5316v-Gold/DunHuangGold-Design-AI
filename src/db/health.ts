/**
 * 数据库健康检查模块（供 /api/health 与内部探测复用）
 *
 * 任务5/6：统一数据库健康检查出口，带缓存（5 秒内不重复探测）。
 */

import { db } from './index';
import { sql } from 'drizzle-orm';

let connectionState: 'unknown' | 'connected' | 'disconnected' = 'unknown';
let lastCheckTime = 0;
const CHECK_INTERVAL = 5000;

/**
 * 检查数据库是否可用（带缓存）
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  if (!db) return false;

  const now = Date.now();
  if (connectionState === 'connected' && now - lastCheckTime < CHECK_INTERVAL) {
    return true;
  }
  if (connectionState === 'disconnected' && now - lastCheckTime < 3000) {
    return false;
  }
  lastCheckTime = now;

  try {
    await db.execute(sql`SELECT 1`);
    connectionState = 'connected';
    return true;
  } catch (error) {
    console.warn(
      '[DB] PostgreSQL 连接失败:',
      error instanceof Error ? error.message : String(error)
    );
    connectionState = 'disconnected';
    return false;
  }
}

/** 强制立即探测（不读缓存，健康检查用） */
export async function probeDatabaseNow(): Promise<boolean> {
  if (!db) return false;
  try {
    await db.execute(sql`SELECT 1`);
    connectionState = 'connected';
    return true;
  } catch {
    connectionState = 'disconnected';
    return false;
  }
}
