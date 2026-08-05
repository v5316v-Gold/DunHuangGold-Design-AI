/**
 * Phase 9.1 · 压测基线脚本
 *
 * 用 Node 原生 http 并发请求压测 /api/health（服务基础吞吐）
 * 目标：记录基线 QPS + P50/P95/P99 延迟
 *
 * 用法：npx tsx scripts/benchmark-health.ts [并发数] [总请求数]
 */
import http from 'http';
import { writeFileSync } from 'fs';

const BASE = process.env.BENCH_URL || 'http://localhost:5000';
const CONCURRENCY = parseInt(process.argv[2] || '20', 10);
const TOTAL = parseInt(process.argv[3] || '200', 10);

interface Sample {
  latencyMs: number;
  status: number;
  ok: boolean;
}

function runOne(): Promise<Sample> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const req = http.get(`${BASE}/api/health`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        const ok = res.statusCode === 200 && body.includes('"ok"');
        resolve({
          latencyMs: Date.now() - start,
          status: res.statusCode ?? 0,
          ok,
        });
      });
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(10_000, () => {
      req.destroy();
      resolve({ latencyMs: 10_000, status: 0, ok: false });
    });
  });
}

async function main() {
  console.log(`🚀 压测开始: ${BASE}/api/health`);
  console.log(`   并发: ${CONCURRENCY} | 总请求: ${TOTAL}\n`);

  const results: Sample[] = [];
  const startAll = Date.now();

  // 并发执行
  let cursor = 0;
  const worker = async () => {
    while (cursor < TOTAL) {
      const idx = cursor++;
      try {
        results[idx] = await runOne();
      } catch {
        results[idx] = { latencyMs: -1, status: 0, ok: false };
      }
    }
  };

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  const totalMs = Date.now() - startAll;

  // 统计
  const latencies = results.filter((r) => r.ok).map((r) => r.latencyMs).sort((a, b) => a - b);
  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;

  const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] ?? 0;

  console.log('--- 结果 ---');
  console.log(`总请求: ${results.length}`);
  console.log(`成功: ${okCount} (${((okCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`失败: ${failCount}`);
  console.log(`总耗时: ${totalMs}ms`);
  console.log(`吞吐: ${((results.length / totalMs) * 1000).toFixed(1)} req/s`);
  console.log(`QPS: ${((okCount / totalMs) * 1000).toFixed(1)} ok/s`);
  console.log(`延迟 P50: ${pct(0.5)}ms`);
  console.log(`延迟 P95: ${pct(0.95)}ms`);
  console.log(`延迟 P99: ${pct(0.99)}ms`);

  // 写报告
  const report = {
    timestamp: new Date().toISOString(),
    base: BASE,
    concurrency: CONCURRENCY,
    total: TOTAL,
    okCount,
    failCount,
    totalMs,
    throughputRps: (results.length / totalMs) * 1000,
    okRps: (okCount / totalMs) * 1000,
    p50Ms: pct(0.5),
    p95Ms: pct(0.95),
    p99Ms: pct(0.99),
  };
  writeFileSync(
    'docs/MIGRATION/PHASE-9-benchmark.json',
    JSON.stringify(report, null, 2)
  );
  console.log('\n📄 报告: docs/MIGRATION/PHASE-9-benchmark.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
