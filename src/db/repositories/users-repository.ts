/**
 * Phase 5.1 · UsersRepository（用户表访问抽象）
 *
 * 职责：users 表读写。覆盖 admin/users 路由 + profile 路由。
 */
import { eq, sql, desc, asc, count } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema/_tables';
import { withRetry } from './db-retry';

export interface UserRow {
  id: string;
  email: string;
  nickname: string | null;
  avatar: string | null;
  role: string;
  status: string;
  power: number;
  createdAt: Date;
  lastLoginAt: Date | null;
}

export class UsersRepository {
  /** 按 id 查找 */
  async findById(id: string): Promise<UserRow | null> {
    if (!db) return null;
    try {
      const rows = await withRetry(() =>
        (db as NonNullable<typeof db>).select().from(users).where(eq(users.id, id)).limit(1)
      );
      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch {
      return null;
    }
  }

  /** 按 email 查找 */
  async findByEmail(email: string): Promise<UserRow | null> {
    if (!db) return null;
    try {
      const rows = await withRetry(() =>
        (db as NonNullable<typeof db>).select().from(users).where(eq(users.email, email)).limit(1)
      );
      return rows[0] ? this.mapRow(rows[0]) : null;
    } catch {
      return null;
    }
  }

  /** 列出用户（分页 + 排序 + 搜索 + 状态过滤） */
  async list(opts: {
    limit?: number;
    offset?: number;
    orderByCreated?: 'asc' | 'desc';
    search?: string;
    status?: string;
  } = {}): Promise<{ items: UserRow[]; total: number }> {
    if (!db) return { items: [], total: 0 };
    const { limit = 50, offset = 0, orderByCreated = 'desc', search, status } = opts;
    try {
      const conditions: any[] = [];
      if (search) {
        conditions.push(sql`(${users.email} LIKE ${'%' + search + '%'} OR ${users.nickname} LIKE ${'%' + search + '%'})`);
      }
      if (status) {
        conditions.push(eq(users.status, status));
      }
      const whereClause = conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;

      const [items, totalRow] = await Promise.all([
        withRetry(() => {
          const q = (db as NonNullable<typeof db>)
            .select()
            .from(users)
            .orderBy(orderByCreated === 'desc' ? desc(users.createdAt) : asc(users.createdAt))
            .limit(limit)
            .offset(offset);
          return whereClause ? q.where(whereClause) : q;
        }),
        withRetry(() => {
          const q = (db as NonNullable<typeof db>).select({ c: count() }).from(users);
          return whereClause ? q.where(whereClause) : q;
        }),
      ]);
      return {
        items: items.map((r) => this.mapRow(r)),
        total: totalRow[0]?.c ?? 0,
      };
    } catch (err) {
      console.error('[UsersRepository] list failed:', err);
      return { items: [], total: 0 };
    }
  }

  /** 充值（增减 power） */
  async adjustPower(id: string, delta: number): Promise<number | null> {
    if (!db) return null;
    try {
      const [result] = await withRetry(() =>
        (db as NonNullable<typeof db>)
          .update(users)
          .set({ power: sql`${users.power} + ${delta}` })
          .where(eq(users.id, id))
          .returning({ power: users.power })
      );
      return result?.power ?? null;
    } catch (err) {
      console.error('[UsersRepository] adjustPower failed:', err);
      return null;
    }
  }

  /** 更新最后登录时间 */
  async touchLastLogin(id: string): Promise<void> {
    if (!db) return;
    try {
      await withRetry(() =>
        (db as NonNullable<typeof db>)
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, id))
      );
    } catch {
      // 静默失败
    }
  }

  private mapRow(row: any): UserRow {
    return {
      id: row.id,
      email: row.email,
      nickname: row.nickname,
      avatar: row.avatar,
      role: row.role,
      status: row.status,
      power: row.power,
      createdAt: row.createdAt,
      lastLoginAt: row.lastLoginAt,
    };
  }
}

export const usersRepository = new UsersRepository();
