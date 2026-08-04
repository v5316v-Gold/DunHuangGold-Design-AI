/**
 * 数据库连接（统一入口）
 *
 * 任务5：统一数据库入口，消除 src/db 与 src/storage/database 双实例。
 *
 * - db 实例统一来自 @/db（单一连接池，max 10）
 * - 本文件保留旧导出 API（isDatabaseAvailable / withRetry / schema），
 *   使 21 个引用 @/storage/database 的文件无需改动即可迁移到单一连接池
 * - schema 直接转发 @/db/schema（表定义唯一真源）
 */

import { sql } from 'drizzle-orm';
import { db as sharedDb } from '@/db';
import { isDatabaseAvailable as checkDb } from '@/db/health';

// ==================== 统一 db 实例 ====================

/** 统一 Drizzle 实例（单一连接池，来自 @/db） */
export const db = sharedDb;

// ==================== 健康检查（带缓存，兼容旧 API） ====================

let connectionState: 'unknown' | 'connected' | 'disconnected' = 'unknown';
let lastCheckTime = 0;
const CHECK_INTERVAL = 5000;

/**
 * 检查数据库是否可用（带缓存，5 秒内不重复探测）
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

// ==================== 重试执行（兼容旧 API） ====================

/**
 * 重试执行数据库操作
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
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }

  throw lastError || new Error('数据库操作失败');
}

// 为兼容导入检查 checkDb 引用（实际使用 isDatabaseAvailable）
void checkDb;

// ==================== schema（转发统一真源） ====================

export * from '@/db/schema';
