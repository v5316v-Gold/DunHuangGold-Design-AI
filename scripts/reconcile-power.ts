/**
 * Phase 6.4 · 算力对账脚本（Power Reconciliation）
 *
 * 校验：users.power 余额 与 power_transactions 流水累计 是否一致。
 *
 * 重要历史：seed.ts 直接写 users.power = 99999/100 等初始值，**未同步写
 * power_transactions 流水**，因此对账公式 users.power vs SUM(transactions)
 * 必然不等。--apply 会补一条 type='adjust' 的修正行让账本自洽。
 *
 * 用法：
 *   npx tsx scripts/reconcile-power.ts            # dry-run（默认，只报告）
 *   npx tsx scripts/reconcile-power.ts --apply    # 真正修复：补 adjust 流水使账本自洽
 *   npx tsx scripts/reconcile-power.ts --user <id>  # 单用户对账
 *
 * 输出：对账结果 JSON + 不一致用户清单
 */

import { db } from '@/db';
import { users, powerTransactions } from '@/db/schema/_tables';
import { sql, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'crypto';

interface Mismatch {
  userId: string;
  email: string | null;
  currentBalance: number;
  ledgerBalance: number;
  diff: number;
}

interface ReconcileResult {
  ok: boolean;
  totalUsers: number;
  checkedUsers: number;
  mismatches: Mismatch[];
}

async function reconcile(onlyUserId?: string): Promise<ReconcileResult> {
  if (!db) {
    console.error('⚠️ DATABASE_URL 未配置，无法对账');
    process.exit(1);
  }

  // 单次 GROUP BY 查所有用户的流水累计（避免 N+1）
  const userFilter = onlyUserId ? eq(users.id, onlyUserId) : undefined;
  const allUsers = await db
    .select({ id: users.id, email: users.email, power: users.power })
    .from(users)
    .where(userFilter);

  const userIds = allUsers.map((u) => u.id);
  const ledgerMap = new Map<string, number>();
  if (userIds.length > 0) {
    const aggRows = await db
      .select({
        userId: powerTransactions.userId,
        total: sql<string>`coalesce(sum(${powerTransactions.amount}), 0)`,
      })
      .from(powerTransactions)
      .where(inArray(powerTransactions.userId, userIds))
      .groupBy(powerTransactions.userId);
    for (const r of aggRows) {
      ledgerMap.set(r.userId, Number(r.total));
    }
  }

  const mismatches: Mismatch[] = [];
  for (const u of allUsers) {
    const ledgerBalance = ledgerMap.get(u.id) ?? 0;
    const diff = (u.power ?? 0) - ledgerBalance;
    if (diff !== 0) {
      mismatches.push({
        userId: u.id,
        email: u.email,
        currentBalance: u.power ?? 0,
        ledgerBalance,
        diff,
      });
    }
  }

  return {
    ok: mismatches.length === 0,
    totalUsers: allUsers.length,
    checkedUsers: allUsers.length,
    mismatches,
  };
}

/**
 * --apply 修复：为每个不一致用户在 power_transactions 补一条 type='adjust' 行，
 * amount=diff（正数补账，负数冲账），使 SUM(transactions) == users.power。
 * 写入带 operatorId='reconcile-power-script' + reason 记录此次对账来源。
 */
async function applyFixes(mismatches: Mismatch[]): Promise<{ fixed: number; failed: number }> {
  if (!db || mismatches.length === 0) return { fixed: 0, failed: 0 };
  let fixed = 0;
  let failed = 0;
  for (const m of mismatches) {
    try {
      // 幂等：先查是否已有同源 adjust 行（避免重复跑 --apply 反复加行）
      const existing = await db
        .select({ id: powerTransactions.id })
        .from(powerTransactions)
        .where(
          sql`${powerTransactions.userId} = ${m.userId}::uuid AND ${powerTransactions.reason} = ${`reconcile --apply diff=${m.diff}`}`
        )
        .limit(1);
      if (existing.length > 0) continue;
      await db.insert(powerTransactions).values({
        userId: m.userId,
        type: 'adjust',
        amount: m.diff,
        balanceBefore: m.ledgerBalance,
        balanceAfter: m.currentBalance,
        reason: `reconcile --apply diff=${m.diff}`,
        operatorId: null,
        operatorEmail: 'reconcile-power-script',
      });
      fixed += 1;
    } catch (e) {
      failed += 1;
      console.error(`  ✗ 修复失败 ${m.userId}:`, (e as Error).message);
    }
  }
  return { fixed, failed };
}

// CLI 入口
const isMain = process.argv[1]?.endsWith('reconcile-power.ts');
if (isMain) {
  const isApply = process.argv.includes('--apply');
  const userIdx = process.argv.indexOf('--user');
  const onlyUser = userIdx >= 0 ? process.argv[userIdx + 1] : undefined;
  const mode = isApply ? 'APPLY' : 'DRY-RUN';

  reconcile(onlyUser)
    .then(async (result) => {
      console.log(`=== 算力对账结果（${mode}）user=${onlyUser ?? 'ALL'} ===`);
      console.log(JSON.stringify(result, null, 2));

      if (!result.ok) {
        console.warn(
          `\n⚠️ 发现 ${result.mismatches.length} 个用户余额与流水不一致` +
            (isApply ? '' : '（dry-run 未修复，加 --apply 执行修复）')
        );
        if (isApply) {
          const { fixed, failed } = await applyFixes(result.mismatches);
          console.log(`\n[apply] 修复成功 ${fixed}/${result.mismatches.length}（幂等：同源 adjust 行已存在则跳过）`);
          if (failed > 0) console.error(`[apply] 失败 ${failed}`);
        }
      } else {
        console.log(`\n✅ 对账通过（${result.checkedUsers}/${result.totalUsers} 用户）`);
      }
      // 主动关闭连接，避免 Node 进程挂起（Drizzle pool keep-alive）
      try {
        const pool = (db as unknown as { $client?: { end?: () => Promise<void> } }).$client;
        if (pool && typeof pool.end === 'function') await pool.end();
      } catch { /* ignore */ }
      process.exit(result.ok && !isApply ? 0 : isApply ? 0 : 1);
    })
    .catch((e) => {
      console.error('对账失败:', e);
      process.exit(1);
    });
}

export { reconcile, applyFixes };
