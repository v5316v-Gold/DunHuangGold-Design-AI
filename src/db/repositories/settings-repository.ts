/**
 * Phase 5.1 · SettingsRepository（系统设置 KV 访问抽象）
 *
 * 职责：system_settings 表读写。用于消除 21 处直调 db（dashboard-stats/api-config 等）。
 * 失败兜底：DB 不可用时返回空对象（不抛错）。
 */
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { systemSettings } from '@/db/schema/_tables';
import { withRetry } from './db-retry';

/* eslint-disable @typescript-eslint/no-explicit-any */


export interface SettingRow {
  key: string;
  value: any;
  description: string | null;
  updatedAt: Date | null;
}

export class SettingsRepository {
  /** 按 key 读取（DB 失败 → 返回 null） */
  async findByKey(key: string): Promise<SettingRow | null> {
    if (!db) return null;
    try {
      const rows = await withRetry(() =>
        (db as NonNullable<typeof db>)
          .select()
          .from(systemSettings)
          .where(eq(systemSettings.key, key))
          .limit(1)
      );
      const row = rows[0];
      if (!row) return null;
      return {
        key: row.key,
        value: row.value,
        description: row.description,
        updatedAt: row.updatedAt,
      };
    } catch {
      return null;
    }
  }

  /** 读取 JSON 字段（自动解析） */
  async findJson<T = any>(key: string): Promise<T | null> {
    const row = await this.findByKey(key);
    if (!row) return null;
    if (typeof row.value === 'string') {
      try {
        return JSON.parse(row.value) as T;
      } catch {
        return null;
      }
    }
    return row.value as T;
  }

  /** 写入或更新（upsert 语义） */
  async upsert(key: string, value: any, description?: string): Promise<void> {
    if (!db) return;
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    try {
      const existing = await this.findByKey(key);
      if (existing) {
        await withRetry(() =>
          (db as NonNullable<typeof db>)
            .update(systemSettings)
            .set({ value: stringValue, description, updatedAt: new Date() })
            .where(eq(systemSettings.key, key))
        );
      } else {
        await withRetry(() =>
          (db as NonNullable<typeof db>).insert(systemSettings).values({
            key,
            value: stringValue,
            description,
          })
        );
      }
    } catch (err) {
      console.error(`[SettingsRepository] upsert ${key} failed:`, err);
    }
  }

  /** 删除 */
  async delete(key: string): Promise<void> {
    if (!db) return;
    try {
      await withRetry(() =>
        (db as NonNullable<typeof db>)
          .delete(systemSettings)
          .where(eq(systemSettings.key, key))
      );
    } catch (err) {
      console.error(`[SettingsRepository] delete ${key} failed:`, err);
    }
  }
}

export const settingsRepository = new SettingsRepository();
