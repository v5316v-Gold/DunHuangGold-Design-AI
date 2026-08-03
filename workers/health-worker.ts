/**
 * 健康检查 Worker（L5 运维层）
 *
 * 职责：独立进程定时探测系统关键依赖，异常时通过告警通道通知。
 *
 * 特性：
 *   - 定时循环（默认每 60 秒，可用 HEALTH_CHECK_INTERVAL 覆盖）
 *   - 状态变化检测：连续异常才告警（避免抖动刷屏）
 *   - 恢复通知：异常恢复后发一条 info
 *   - 告警通道：控制台 + Webhook（钉钉/企微/Slack）+ 邮件（预留）
 *
 * 运行：node dist-workers/health-worker.js
 * 或在 package.json 加 script: "worker:health": "tsx workers/health-worker.ts"
 */

import { runSystemHealthCheck } from '@/lib/health/system-health';
import { alertManager } from '@/lib/health/alerts';

// ============================================================
// 配置
// ============================================================

const INTERVAL_MS = Number(process.env.HEALTH_CHECK_INTERVAL || 60_000);
// 连续 N 次异常才告警（防抖动）
const ALERT_THRESHOLD = Number(process.env.HEALTH_ALERT_THRESHOLD || 2);
// 关键检查项（down 视为 critical，degraded 视为 warning）
const CRITICAL_CHECKS = ['postgres', 'redis', 'comfyui'];
const WARNING_CHECKS = ['workers', 'storage', 'thirdParty'];

// ============================================================
// 状态跟踪
// ============================================================

/** 各检查项的连续异常次数 */
const consecutiveFailures: Record<string, number> = {};
/** 各检查项上一次状态（用于恢复通知） */
const lastStatus: Record<string, string> = {};

// ============================================================
// 主循环
// ============================================================

async function runOnce() {
  try {
    const report = await runSystemHealthCheck();

    for (const [name, check] of Object.entries(report.checks)) {
      const isOk = check.status === 'ok';
      const isUnknown = check.status === 'unknown';
      const isCritical = CRITICAL_CHECKS.includes(name);
      const isWarning = WARNING_CHECKS.includes(name);

      // 跳过 unknown（未配置项不告警）
      if (isUnknown) {
        consecutiveFailures[name] = 0;
        continue;
      }

      if (!isOk) {
        // 连续异常计数
        consecutiveFailures[name] = (consecutiveFailures[name] || 0) + 1;

        // 达到阈值才告警
        if (consecutiveFailures[name] === ALERT_THRESHOLD) {
          const severity = isCritical ? 'critical' : 'warning';
          const detail = `${name} 状态异常: ${check.status}${check.detail ? ` (${check.detail})` : ''}，延迟 ${check.latencyMs ?? '-'}ms`;
          await alertManager.send({
            title: `[${severity.toUpperCase()}] ${name} 异常`,
            detail,
            severity,
            source: 'health-check',
            data: { status: check.status, latencyMs: check.latencyMs, consecutive: consecutiveFailures[name] },
          });
        }
        lastStatus[name] = check.status;
      } else {
        // 恢复通知
        if (consecutiveFailures[name] && consecutiveFailures[name] >= ALERT_THRESHOLD) {
          await alertManager.send({
            title: `${name} 已恢复`,
            detail: `${name} 状态恢复正常（延迟 ${check.latencyMs ?? '-'}ms）`,
            severity: 'info',
            source: 'health-check',
          });
        }
        consecutiveFailures[name] = 0;
        lastStatus[name] = 'ok';
      }
    }

    // 汇总日志（每轮输出一次当前状态）
    const summary = Object.entries(report.checks)
      .map(([n, c]) => `${n}=${c.status}`)
      .join(' ');
    const ts = new Date().toISOString();
    const level = report.status === 'ok' ? 'log' : 'warn';
    console[level](`[health-worker] ${ts} 聚合=${report.status} | ${summary}`);
  } catch (e) {
    console.error('[health-worker] 健康检查异常:', e instanceof Error ? e.message : e);
  }
}

// ============================================================
// 启动
// ============================================================

async function main() {
  console.log(`[health-worker] 启动，探测间隔 ${INTERVAL_MS}ms，告警阈值 ${ALERT_THRESHOLD}`);
  console.log(`[health-worker] 告警通道: ${alertManager.configuredChannels().join(', ') || '无'}`);

  // 立即执行一次
  await runOnce();

  // 定时循环
  const timer = setInterval(runOnce, INTERVAL_MS);
  timer.unref?.();

  // 优雅关闭
  process.on('SIGTERM', () => {
    console.log('[health-worker] 关闭');
    clearInterval(timer);
    process.exit(0);
  });
  process.on('SIGINT', () => {
    clearInterval(timer);
    process.exit(0);
  });
}

main().catch((e) => {
  console.error('[health-worker] 启动失败:', e instanceof Error ? e.message : e);
  process.exit(1);
});
