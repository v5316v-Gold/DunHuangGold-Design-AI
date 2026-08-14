/**
 * Phase 5.1 · RulesRepository（提示词/规则访问抽象）
 *
 * 职责：prompt_rules 表读写。覆盖 admin/rules 路由 + RuleManagerModal 组件。
 */
import { eq, desc, asc } from 'drizzle-orm';
import { db } from '@/db';
import { promptRules } from '@/db/schema/_tables';
import { withRetry } from './db-retry';

/* eslint-disable @typescript-eslint/no-explicit-any */


export interface RuleRow {
  id: string;
  category: string;
  name: string;
  systemPrompt: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export class RulesRepository {
  async list(category?: string): Promise<RuleRow[]> {
    if (!db) return [];
    try {
      const query = category
        ? (db as NonNullable<typeof db>).select().from(promptRules).where(eq(promptRules.category, category))
        : (db as NonNullable<typeof db>).select().from(promptRules);
      const rows = await withRetry(() => query.orderBy(asc(promptRules.sortOrder)));
      return rows.map(this.mapRow);
    } catch (err) {
      console.error('[RulesRepository] list failed:', err);
      return [];
    }
  }

  async listEnabled(category?: string): Promise<RuleRow[]> {
    const all = await this.list(category);
    return all.filter((r) => r.enabled);
  }

  async findById(id: string): Promise<RuleRow | null> {
    if (!db) return null;
    try {
      const rows = await withRetry(() =>
        (db as NonNullable<typeof db>).select().from(promptRules).where(eq(promptRules.id, id)).limit(1)
      );
      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch {
      return null;
    }
  }

  async upsert(rule: Partial<RuleRow> & { id: string; category: string; name: string; systemPrompt: string }): Promise<void> {
    if (!db) return;
    try {
      const existing = await this.findById(rule.id);
      if (existing) {
        await withRetry(() =>
          (db as NonNullable<typeof db>)
            .update(promptRules)
            .set({
              category: rule.category,
              name: rule.name,
              systemPrompt: rule.systemPrompt,
              enabled: rule.enabled ?? true,
              sortOrder: rule.sortOrder ?? 0,
              updatedAt: new Date(),
            })
            .where(eq(promptRules.id, rule.id))
        );
      } else {
        await withRetry(() =>
          (db as NonNullable<typeof db>).insert(promptRules).values({
            id: rule.id,
            category: rule.category,
            name: rule.name,
            systemPrompt: rule.systemPrompt,
            enabled: rule.enabled ?? true,
            sortOrder: rule.sortOrder ?? 0,
          })
        );
      }
    } catch (err) {
      console.error(`[RulesRepository] upsert ${rule.id} failed:`, err);
    }
  }

  async delete(id: string): Promise<void> {
    if (!db) return;
    try {
      await withRetry(() =>
        (db as NonNullable<typeof db>).delete(promptRules).where(eq(promptRules.id, id))
      );
    } catch (err) {
      console.error(`[RulesRepository] delete ${id} failed:`, err);
    }
  }

  private mapRow = (row: any): RuleRow => ({
    id: row.id,
    category: row.category,
    name: row.name,
    systemPrompt: row.systemPrompt,
    enabled: row.enabled ?? true,
    sortOrder: row.sortOrder ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export const rulesRepository = new RulesRepository();
