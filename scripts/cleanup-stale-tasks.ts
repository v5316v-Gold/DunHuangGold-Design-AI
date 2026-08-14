/**
 * Phase 9.22 · 陈旧任务清理脚本（Stale Task Cleanup）
 *
 * 目的：清理长期停留在中间状态的任务（queued/processing），
 * 防止堆积占资源、阻塞队列。
 *
 * 清理边界（G5 软删除/物理清理策略）：
 *   - 软删除：status 中间态（queued/processing）超过 STALE_AFTER_HOURS → 置为 failed
 *     （保留记录，供审计/对账）
 *   - 物理清理：status=completed/failed/cancelled/dead_letter 超过 PURGE_AFTER_DAYS
 *     → 物理删除（可配置，默认关闭 --purge 才执行）
 *
 * 安全：
 *   - 默认 dry-run（只报告不修改）
 *   - --apply 才真正执行
 *   - 所有操作打日志
 *
 * 用法：
 *   npx tsx scripts/cleanup-stale-tasks.ts                          # dry-run（默认）
 *   npx tsx scripts/cleanup-stale-tasks.ts --apply                  # 真正执行
 *   npx tsx scripts/cleanup-stale-tasks.ts --stale-hours 24         # 自定义超时
 *   npx tsx scripts/cleanup-stale-tasks.ts --purge --purge-days 30  # 物理清理
 */

import 'dotenv/config';
import { db } from '@/db';
import { tasks } from '@/db/schema/_tables';
import { and, lt, inArray, eq } from 'drizzle-orm';
import { createLogger } from '@/lib/error-handler';

const logger = createLogger('cleanup-stale-tasks');

const STALE_AFTER_HOURS_DEFAULT = 24;
const PURGE_AFTER_DAYS_DEFAULT = 30;
const STALE_STATUSES = ['queued', 'processing'] as const;
const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled', 'dead_letter'] as const;

interface Args {
  apply: boolean;
  staleHours: number;
  purge: boolean;
  purgeDays: number;
}

function parseArgs(argv: string[]): Args {
  return {
    apply: argv.includes('--apply'),
    staleHours: (() => {
      const i = argv.indexOf('--stale-hours');
      return i >= 0 ? parseInt(argv[i + 1] ?? '', 10) || STALE_AFTER_HOURS_DEFAULT : STALE_AFTER_HOURS_DEFAULT;
    })(),
    purge: argv.includes('--purge'),
    purgeDays: (() => {
      const i = argv.indexOf('--purge-days');
      return i >= 0 ? parseInt(argv[i + 1] ?? '', 10) || PURGE_AFTER_DAYS_DEFAULT : PURGE_AFTER_DAYS_DEFAULT;
    })(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const mode = args.apply ? 'APPLY' : 'DRY-RUN';

  if (!db) {
    logger.error('[cleanup] DB 不可用，退出');
    process.exit(1);
  }

  const staleCutoff = new Date(Date.now() - args.staleHours * 3600 * 1000);
  const purgeCutoff = new Date(Date.now() - args.purgeDays * 86400 * 1000);

  logger.info(`[cleanup] 模式=${mode} staleHours=${args.staleHours} purge=${args.purge} purgeDays=${args.purgeDays}`);
  logger.info(`[cleanup] stale 截止=${staleCutoff.toISOString()} purge 截止=${purgeCutoff.toISOString()}`);

  // ===== 1. 软删除：中间态超时 → failed =====
  const staleRows = await db
    .select({ id: tasks.id, status: tasks.status, createdAt: tasks.createdAt })
    .from(tasks)
    .where(
      and(
        inArray(tasks.status, [...STALE_STATUSES]),
        lt(tasks.createdAt, staleCutoff)
      )
    );

  logger.info(`[cleanup] 陈旧中间态任务 ${staleRows.length} 条（stale > ${args.staleHours}h）`);
  staleRows.forEach((r) => logger.info(`  - ${r.id} status=${r.status} created=${r.createdAt?.toISOString()}`));

  if (args.apply && staleRows.length > 0) {
    await db
      .update(tasks)
      .set({ status: 'failed' })
      .where(
        and(
          inArray(tasks.status, [...STALE_STATUSES]),
          lt(tasks.createdAt, staleCutoff)
        )
      );
    logger.info(`[cleanup] ✅ 已软删除 ${staleRows.length} 条（→ failed）`);
  }

  // ===== 2. 物理清理：终止态超时 → 删除（仅 --purge）=====
  if (args.purge) {
    const purgeRows = await db
      .select({ id: tasks.id, status: tasks.status, completedAt: tasks.completedAt, createdAt: tasks.createdAt })
      .from(tasks)
      .where(
        and(
          inArray(tasks.status, [...TERMINAL_STATUSES]),
          lt(tasks.createdAt, purgeCutoff)
        )
      );

    logger.info(`[cleanup] 可物理清理任务 ${purgeRows.length} 条（终止态 > ${args.purgeDays}d）`);
    purgeRows.forEach((r) => logger.info(`  - ${r.id} status=${r.status} created=${r.createdAt?.toISOString()}`));

    if (args.apply && purgeRows.length > 0) {
      const ids = purgeRows.map((r) => r.id);
      await db.delete(tasks).where(inArray(tasks.id, ids));
      logger.info(`[cleanup] ✅ 已物理删除 ${ids.length} 条`);
    }
  } else {
    logger.info('[cleanup] 未启用 --purge，跳过物理清理（保留终止态记录供审计）');
  }

  logger.info(`[cleanup] 完成（${mode}）`);
}

main().catch((e) => {
  logger.error('[cleanup] 执行失败:', e);
  process.exit(1);
});
