/**
 * JWT 撤销机制（token_version）端到端测试
 *
 * 流程：
 *   1. 生成 token（ver=0）
 *   2. verifyToken 应成功
 *   3. bumpTokenVersion → ver=1
 *   4. 旧 token verifyToken 应失败（撤销生效）
 *   5. 新生成 token（ver=1）应成功
 *   6. bumpTokenVersion → ver=2
 *   7. 上一版新 token（ver=1）也失效
 */
// 必须在 import auth 之前设置 JWT_SECRET（auth.ts 模块顶层读取 process.env.JWT_SECRET 冻结）
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-32-chars-validation';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateToken, verifyToken } from '@/lib/auth';
import { getCurrentTokenVersion, bumpTokenVersion } from '@/lib/token-version';
import { db } from '@/db';
import { users } from '@/db/schema/_tables';
import { eq } from 'drizzle-orm';

const TEST_USER_ID = '00000000-0000-0000-0000-000000000999';

beforeAll(async () => {
  // 兜底再设一次（防止其它测试文件在同 worker 内覆盖了 env）
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-32-chars-validation';
  // 确保测试用户存在（id 用固定 UUID 便于幂等）
  if (db) {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, TEST_USER_ID)).limit(1);
    if (!existing) {
      await db.insert(users).values({
        id: TEST_USER_ID,
        email: 'jwt-revocation-test@test.local',
        passwordHash: '$2a$12$dummy.hash.for.jwt.revocation.test.only',
        role: 'user',
      });
    }
    // 重置 token_version 到 0（让每次测试可预测）
    await db.update(users).set({ tokenVersion: 0, updatedAt: new Date() }).where(eq(users.id, TEST_USER_ID));
  }
});

// 保存原始 env，在 afterAll 恢复（vitest worker_threads 共享 process.env，避免污染其他测试文件）
const ORIGINAL_ENV = { ...process.env };
afterAll(async () => {
  // 清理：把测试用户的 token_version 重置为 0，避免影响其他测试
  if (db) {
    await db.update(users).set({ tokenVersion: 0, updatedAt: new Date() }).where(eq(users.id, TEST_USER_ID));
  }
  // 恢复原始 env（关键：DATABASE_URL / JWT_SECRET 等会污染其他测试文件的 PowerLedger / auth）
  for (const k of Object.keys(process.env)) {
    if (!(k in ORIGINAL_ENV)) delete process.env[k];
  }
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('JWT 撤销机制（tokenVersion）', () => {
  it('生成 token + verifyToken 应成功（ver=0）', async () => {
    const token = await generateToken({ userId: TEST_USER_ID, email: 't@t', role: 'user', ver: 0 });
    const payload = await verifyToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.ver).toBe(0);
  });

  it('bumpTokenVersion 后旧 token 应被拒绝', async () => {
    const token0 = await generateToken({ userId: TEST_USER_ID, email: 't@t', role: 'user', ver: 0 });
    expect((await verifyToken(token0))?.ver).toBe(0);

    // 模拟 logout：bumpTokenVersion（ver: 0 → 1）
    const before = await getCurrentTokenVersion(TEST_USER_ID);
    expect(before).toBe(0);
    const affected = await bumpTokenVersion(TEST_USER_ID);
    expect(affected).toBe(1);
    const after = await getCurrentTokenVersion(TEST_USER_ID);
    expect(after).toBe(1);

    // 旧 token 现在应被拒绝（DB ver=1，JWT ver=0，不一致）
    const oldPayload = await verifyToken(token0);
    expect(oldPayload).toBeNull();
  });

  it('bump 后新生成的 token（ver=1）应成功', async () => {
    const token1 = await generateToken({ userId: TEST_USER_ID, email: 't@t', role: 'user', ver: 1 });
    const payload = await verifyToken(token1);
    expect(payload).not.toBeNull();
    expect(payload?.ver).toBe(1);
  });

  it('连续 bump：每个旧版本都应立即失效', async () => {
    // DB 此时是上一步留下的 ver=1，再 bump 一次到 ver=2
    await bumpTokenVersion(TEST_USER_ID);
    expect(await getCurrentTokenVersion(TEST_USER_ID)).toBe(2);
    // 生成 ver=2 token → 应成功
    const v2 = await generateToken({ userId: TEST_USER_ID, email: 't@t', role: 'user', ver: 2 });
    expect((await verifyToken(v2))?.ver).toBe(2);
    // logout 一次：ver 2 → 3，v2 token 立即失效
    await bumpTokenVersion(TEST_USER_ID);
    expect(await verifyToken(v2)).toBeNull();

    // 新生成 ver=3 token 应成功
    const v3 = await generateToken({ userId: TEST_USER_ID, email: 't@t', role: 'user', ver: 3 });
    expect((await verifyToken(v3))?.ver).toBe(3);
    // 再 logout 一次，v3 也失效
    await bumpTokenVersion(TEST_USER_ID);
    expect(await verifyToken(v3)).toBeNull();
  });
});
