#!/usr/bin/env node
/**
 * 敦煌金 AI · 简易负载测试脚本（O12 骨架）
 *
 * 验证场景：
 *   - 100 并发用户同时调 text2img / dialogue 接口
 *   - 验证：幂等（不双扣算力）、BullMQ 队列不丢、响应时间分布
 *
 * 用法：
 *   E2E_BASE_URL=http://127.0.0.1:5000 \
 *   E2E_ADMIN_EMAIL=admin@dunhuang.com \
 *   E2E_ADMIN_PASSWORD=admin123 \
 *   CONCURRENCY=50 ITERATIONS=10 \
 *   node scripts/load-test.mjs
 *
 * 真实负载测试建议用 k6（容器内置）+ 真实负载生成器。
 * 本脚本只是骨架 — 验证并发 + 幂等关键路径。
 */
import { request } from 'undici';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:5000';
const EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@dunhuang.com';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'admin123';
const CONCURRENCY = Number(process.env.CONCURRENCY) || 20;
const ITERATIONS = Number(process.env.ITERATIONS) || 5;

async function login() {
  const resp = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const setCookie = resp.headers.get('set-cookie') || '';
  const authToken = setCookie.split(';')[0];
  if (!resp.ok) throw new Error(`Login failed: ${resp.status}`);
  return authToken;
}

async function callText2img(authToken, i) {
  const start = Date.now();
  try {
    const resp = await fetch(`${BASE}/api/ai/generate-async`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authToken,
      },
      body: JSON.stringify({
        featureId: 'text2img',
        params: { prompt: `loadtest-${i}-${Date.now()}`, count: 1, resolution: '2k', ratio: 'auto' },
      }),
    });
    const elapsed = Date.now() - start;
    const json = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, elapsed, taskId: json?.data?.taskId, duplicate: !!json?.data?.duplicate };
  } catch (e) {
    return { ok: false, error: e.message, elapsed: Date.now() - start };
  }
}

async function main() {
  console.log(`[load-test] login → ${EMAIL}`);
  const authToken = await login();
  console.log(`[load-test] concurrency=${CONCURRENCY} iterations=${ITERATIONS} total=${CONCURRENCY * ITERATIONS}`);

  // 收集指标
  const stats = { ok: 0, failed: 0, duplicates: 0, latencies: [] };

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const batch = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) => callText2img(authToken, iter * CONCURRENCY + i))
    );
    for (const r of batch) {
      if (r.ok) stats.ok++;
      else stats.failed++;
      if (r.duplicate) stats.duplicates++;
      if (typeof r.elapsed === 'number') stats.latencies.push(r.elapsed);
    }
  }

  // 报告
  const sorted = stats.latencies.slice().sort((a, b) => a - b);
  const p = (q) => sorted.length ? sorted[Math.floor(sorted.length * q)] : 0;
  console.log(`\n=== 结果 ===`);
  console.log(`总数: ${stats.ok + stats.failed}（成功 ${stats.ok} / 失败 ${stats.failed}）`);
  console.log(`幂等命中: ${stats.duplicates}`);
  console.log(`响应延迟：min=${sorted[0] || 0}ms p50=${p(0.5)}ms p95=${p(0.95)}ms p99=${p(0.99)}ms max=${sorted[sorted.length - 1] || 0}ms`);
}

main().catch(e => { console.error(e); process.exit(1); });
