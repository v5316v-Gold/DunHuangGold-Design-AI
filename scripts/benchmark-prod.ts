/**
 * Phase 9.13 · 生产模式容量压测（阶梯并发）
 *
 * 与 dev 模式不同点：
 * - 无 hot-reload 编译开销
 * - 无 source map
 * - 静态资源预构建
 *
 * 用法：
 *   BENCH_URL=http://localhost:5000/api/health BENCH_MODE=step ./node_modules/.bin/tsx scripts/benchmark-prod.ts
 *
 * 阶梯并发：10 → 50 → 100 → 200 → 500
 * 每个阶段 200 请求，间隔 5s 让系统恢复
 */
import * as http from 'node:http';
import * as https from 'node:https';
import { URL } from 'node:url';

const BENCH_URL = process.env.BENCH_URL || 'http://localhost:5000/api/health';
const PHASES: { name: string; concurrency: number; total: number }[] = [
  { name: 'Phase-1', concurrency: 10, total: 200 },
  { name: 'Phase-2', concurrency: 50, total: 200 },
  { name: 'Phase-3', concurrency: 100, total: 200 },
  { name: 'Phase-4', concurrency: 200, total: 200 },
  { name: 'Phase-5', concurrency: 500, total: 200 },
];

interface Stat {
  phase: string;
  concurrency: number;
  total: number;
  success: number;
  failed: number;
  totalMs: number;
  qps: number;
  p50: number;
  p95: number;
  p99: number;
  maxMs: number;
  errors: Record<string, number>;
}

async function singleRequest(url: string): Promise<{ ok: boolean; status: number; ms: number; err?: string }> {
  const start = Date.now();
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { 'X-Real-IP': `bench-${process.pid}-${Date.now()}` },
        timeout: 30000,
      },
      (res) => {
        res.on('data', () => {}); // 丢弃 body
        res.on('end', () => {
          resolve({
            ok: res.statusCode === 200,
            status: res.statusCode || 0,
            ms: Date.now() - start,
          });
        });
      }
    );
    req.on('error', (e) => {
      resolve({ ok: false, status: 0, ms: Date.now() - start, err: e.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: 0, ms: Date.now() - start, err: 'timeout' });
    });
    req.end();
  });
}

async function runPhase(phase: typeof PHASES[0]): Promise<Stat> {
  console.log(`\n🚀 ${phase.name}: ${BENCH_URL}`);
  console.log(`   并发: ${phase.concurrency} | 总请求: ${phase.total}`);

  const results: { ok: boolean; ms: number; err?: string }[] = [];
  const startBatch = Date.now();

  // 控制并发信号量
  const queue: Promise<void>[] = [];
  let inFlight = 0;
  let dispatched = 0;
  const errors: Record<string, number> = {};

  await new Promise<void>((resolve) => {
    const dispatch = () => {
      while (inFlight < phase.concurrency && dispatched < phase.total) {
        inFlight++;
        dispatched++;
        singleRequest(BENCH_URL).then((r) => {
          results.push(r);
          if (!r.ok && r.err) {
            errors[r.err] = (errors[r.err] || 0) + 1;
          }
          inFlight--;
          if (dispatched >= phase.total && inFlight === 0) {
            resolve();
          } else {
            dispatch();
          }
        });
      }
    };
    dispatch();
  });

  const totalMs = Date.now() - startBatch;
  const success = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b);
  const p = (q: number) => latencies[Math.floor(latencies.length * q)] || 0;
  const stat: Stat = {
    phase: phase.name,
    concurrency: phase.concurrency,
    total: phase.total,
    success,
    failed,
    totalMs,
    qps: (success / totalMs) * 1000,
    p50: p(0.5),
    p95: p(0.95),
    p99: p(0.99),
    maxMs: latencies[latencies.length - 1] || 0,
    errors,
  };
  console.log(`   吞吐: ${stat.qps.toFixed(1)} req/s | P50: ${stat.p50}ms | P95: ${stat.p95}ms | P99: ${stat.p99}ms | Max: ${stat.maxMs}ms`);
  console.log(`   成功: ${success} | 失败: ${failed}${Object.keys(errors).length > 0 ? ` | 错误: ${JSON.stringify(errors)}` : ''}`);

  // 间隔 5s 让系统恢复
  if (phase !== PHASES[PHASES.length - 1]) {
    console.log(`   ⏸ 等待 5s 系统恢复...`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  return stat;
}

async function main() {
  console.log(`🎯 目标: ${BENCH_URL}`);
  console.log(`📊 阶段: ${PHASES.length}（${PHASES.map((p) => p.concurrency).join(' → ')} 并发）`);

  // 先 warmup 一次（让 Next.js 编译路由）
  console.log(`\n🔥 Warmup...`);
  await singleRequest(BENCH_URL);

  const stats: Stat[] = [];
  for (const phase of PHASES) {
    stats.push(await runPhase(phase));
  }

  console.log(`\n📈 容量基线汇总:`);
  console.log(`阶段\t并发\t成功\tQPS\tP50\tP95\tP99\tMax`);
  for (const s of stats) {
    console.log(`${s.phase}\t${s.concurrency}\t${s.success}/${s.total}\t${s.qps.toFixed(1)}\t${s.p50}\t${s.p95}\t${s.p99}\t${s.maxMs}ms`);
  }

  // 写报告
  const reportPath = 'docs/MIGRATION/PHASE-9-benchmark-prod.json';
  const fs = await import('node:fs/promises');
  await fs.mkdir('docs/MIGRATION', { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({
    target: BENCH_URL,
    timestamp: new Date().toISOString(),
    stats,
  }, null, 2));
  console.log(`\n📄 报告: ${reportPath}`);
}

main().catch((e) => {
  console.error('压测失败:', e);
  process.exit(1);
});