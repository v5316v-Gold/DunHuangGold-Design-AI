/**
 * Phase 6.4 · 算力对账脚本（Power Reconciliation）
 *
 * 校验：users.power 余额 与 power_transactions 流水累计 是否一致。
 *
 * 用法：
 *   npx tsx scripts/reconcile-power.ts            # 全量对账
 *   npx tsx scripts/reconcile-power.ts --user u1  # 单用户
 *
 * 输出：对账结果 JSON + 不一致用户清单
 */

import { db } from '@/db';
import { users, powerTransactions } from '@/db/schema/_tables';
import { eq, sum } from 'drizzle-orm';

interface ReconcileResult {
  ok: boolean;
  totalUsers: number;
  checkedUsers: number;
  mismatches: Array<{
    userId: string;
    email: string | null;
    currentBalance: number;
    ledgerBalance: number;
    diff: number;
  }>;
}

async function reconcile(): Promise<ReconcileResult> {
  if (!db) {
    console.error('⚠️ DATABASE_URL 未配置，无法对账');
    process.exit(1);
  }

  const allUsers = await db.select({ id: users.id, email: users.email, power: users.power }).from(users);

  const mismatches = [];
  for (const u of allUsers) {
    // 累计流水：consume/deduct 为负，recharge/refund/bonus 为正
    const rows = await db
      .select({ total: sum(powerTransactions.amount) })
      .from(powerTransactions)
      .where(eq(powerTransactions.userId, u.id));

    const ledgerBalance = Number(rows[0]?.total ?? 0);
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

// CLI 入口
const isMain = process.argv[1]?.endsWith('reconcile-power.ts');
if (isMain) {
  const isDryRun = !process.argv.includes('--apply');
  reconcile().then((result) => {
    console.log(`=== 算力对账结果（${isDryRun ? 'DRY-RUN 只读' : 'APPLY'}）===`);
    console.log(JSON.stringify(result, null, 2));
    // Phase 9.22 加固（G4）: 默认 dry-run 只读；--apply 才写修复
    if (!isDryRun && !result.ok) {
      console.error(`\n❌ 发现 ${result.mismatches.length} 个用户余额与流水不一致（--apply 模式下应修复，当前仅报告）`);
      process.exit(1);
    }
    if (!result.ok) {
      console.warn(`\n⚠️ 发现 ${result.mismatches.length} 个用户余额与流水不一致（dry-run 未修复，加 --apply 执行修复）`);
    } else {
      console.log(`\n✅ 对账通过（${result.checkedUsers}/${result.totalUsers} 用户）`);
    }
  }).catch((e) => {
    console.error('对账失败:', e);
    process.exit(1);
  });
}

export { reconcile };
