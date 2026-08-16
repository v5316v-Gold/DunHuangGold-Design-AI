/**
 * Token 版本管理（JWT 撤销机制）
 *
 * 流程：
 *   1. login/register 调 getCurrentTokenVersion(userId) 拿当前 ver
 *   2. generateToken({...,ver}) 把 ver 写进 JWT
 *   3. 每次 verifyToken 调 assertTokenVersion(userId, ver)
 *   4. logout UPDATE users SET token_version = token_version + 1
 *      → 之前签发的 token 立即失效
 */
import { db } from '@/db';
import { users } from '@/db/schema/_tables';
import { eq } from 'drizzle-orm';

/** 读取用户当前 token_version（无 DB 返回 -1 表示用户不存在或 DB 不可用 → 拒绝） */
export async function getCurrentTokenVersion(userId: string): Promise<number> {
  if (!db) return -1;
  try {
    const [row] = await db
      .select({ tokenVersion: users.tokenVersion })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row?.tokenVersion ?? -1;
  } catch {
    return -1;
  }
}

/** 校验 JWT 中的 ver 是否等于 DB 中当前 ver；不等返回 false（token 视为无效） */
export async function assertTokenVersion(userId: string, ver: number | undefined): Promise<boolean> {
  if (ver === undefined || ver === null) return false; // 旧 token 没 ver 字段直接拒绝
  const current = await getCurrentTokenVersion(userId);
  if (current < 0) return false; // 用户不存在 / DB 不可用
  return current === ver;
}

/** 撤销用户所有 token：++token_version。返回受影响的行数（0 = 用户不存在） */
export async function bumpTokenVersion(userId: string): Promise<number> {
  if (!db) return 0;
  try {
    // 原子自增；用 RETURNING 拿新值
    const result = await db
      .update(users)
      .set({ tokenVersion: (await getCurrentTokenVersion(userId)) + 1, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({ tokenVersion: users.tokenVersion });
    return result.length;
  } catch {
    return 0;
  }
}
