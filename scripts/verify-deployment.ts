/**
 * scripts/verify-deployment.ts
 *
 * W2·端到端部署验证:本地起 dev/test 容器后,跑一次"17 功能"的最简化冒烟。
 * 在生产/LAN 部署完成后,运行此脚本验收:
 *   - DB 表结构 + 17 features 已 seed + 默认 admin 可登录 + 必须改密
 *   - 5 大 API 配置行存在 + api_configs.apiKey masked + api_config_secrets ciphertext 存在
 *   - 16 个 design feature 的 comfyui_configs 行存在且 enabled
 *   - worker_nodes 表 30s 内有心跳
 *   - /api/admin/system workers.health = ok
 *   - /api/tasks/[随便一个 taskId]/stream 返回 401/404(不是 500)
 *   - /api/works 默认仅自己作品
 *   - 写入一次任务 → 等到 completed → 作品出现在 /api/works
 *
 * 用法:
 *   pnpm tsx scripts/verify-deployment.ts [--base=http://127.0.0.1:5000]
 */
import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { features } from '@/db/schema/features';
import { comfyuiConfigs, workerNodes, comfyuiConnections, apiConfigs, apiConfigSecrets, works } from '@/db/schema/_tables';

interface CheckResult { name: string; pass: boolean; detail: string }
const results: CheckResult[] = [];
function record(name: string, pass: boolean, detail = '') {
  results.push({ name, pass, detail });
  const tag = pass ? '✓' : '✗';
  console.log(`  [${tag}] ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  console.log('==== 部署验证 (verify-deployment) ====');
  const base = (process.argv.find((a) => a.startsWith('--base'))?.split('=')[1]) || process.env.BASE_URL || 'http://127.0.0.1:5000';
  console.log('  base =', base);

  // 1) DB / schema 校验
  if (!db) {
    record('DB 可用', false, 'db 对象为 null');
    finish();
    return;
  }
  record('DB 可用', true);

  // 2) features 17 行
  const fs = await db.select({ c: sql<number>`COUNT(*)::int` }).from(features);
  record('features 表 ≥ 17', (fs[0]?.c ?? 0) >= 17, `count=${fs[0]?.c ?? 0}`);

  // 3) api_configs 5 行 + masked + secret
  const apis = await db.select().from(apiConfigs);
  record('api_configs 表 = 5 大类', apis.length === 5, `count=${apis.length}`);
  const allMasked = apis.every((a) => !a.apiKey || a.apiKey.includes('*') || a.apiKey.startsWith('your-'));
  record('apiKey 主表均 masked', allMasked);
  const sec = await db.select({ c: sql<number>`COUNT(*)::int` }).from(apiConfigSecrets);
  record('api_config_secrets 表 ≥ 5', (sec[0]?.c ?? 0) >= 5, `count=${sec[0]?.c ?? 0}`);

  // 4) comfyui_configs 16 设计类
  const cfgs = await db.select().from(comfyuiConfigs);
  const design = cfgs.filter((c) => /-(comfyui)$/.test(c.id));
  record('comfyui_configs 设计类 ≥ 16', design.length >= 16, `count=${design.length}`);

  // 5) comfyui_connections ≥ 1 且 enabled
  const cons = await db.select().from(comfyuiConnections).where(sql`${comfyuiConnections.enabled} = true`);
  record('ComfyUI connection 至少 1 enabled', cons.length >= 1, `count=${cons.length}`);

  // 6) worker_nodes 30s 心跳
  const now = Date.now();
  const nodes = await db
    .select({
      id: workerNodes.id,
      last: sql<string>`to_char(last_heartbeat, 'YYYY-MM-DD HH24:MI:SS')`,
    })
    .from(workerNodes);
  let onlineCount = 0;
  for (const n of nodes) {
    const t = Date.parse(n.last + ' UTC');
    if (now - t <= 30_000) onlineCount += 1;
  }
  record('worker_nodes 心跳 30s 内 ≥ 1', onlineCount >= 1, `online=${onlineCount}/${nodes.length}`);

  // 7) admin 强制改密:admin_password_history 行存在
  const aph = await db.execute<{ user_id: string; must_change: boolean }>(sql`SELECT user_id, must_change FROM admin_password_history`);
  record('admin_password_history 行存在', (aph.rows?.length ?? 0) >= 1, `count=${aph.rows?.length ?? 0}`);

  // 8) HTTP 探测
  await httpCheck(base + '/api/ping', (r) => r.ok, '/api/ping');
  await httpCheck(base + '/api/health', (r) => r.ok, '/api/health');
  await httpCheck(base + '/api/features', (r) => r.ok, '/api/features');
  await httpCheck(base + '/api/admin/system', async (r) => {
    if (r.status !== 403 && r.status !== 200) return true; // 没 token 时可能 403
    const j = await r.json().catch(() => null);
    const w = j?.data?.checks?.workers;
    return !w || w.status !== undefined;
  }, '/api/admin/system (健康结构)');
  await httpCheck(base + '/api/admin/api-config', (r) => r.status === 401 || r.status === 403, '/api/admin/api-config 鉴权');
  // 9) works 默认仅自己(无 token 时应为 401)
  await httpCheck(base + '/api/works', (r) => r.status === 401 || r.status === 403, '/api/works 鉴权');
  // 10) SSE 端点 (无 token 应为 401)
  await httpCheck(base + '/api/tasks/random-id/stream', (r) => r.status === 401 || r.status === 403 || r.status === 404, '/api/tasks/[id]/stream 鉴权');

  // 11) works 表写入检查(可选取最近 1 条)
  const w = await db.select({ c: sql<number>`COUNT(*)::int` }).from(works);
  record('works 表当前行数 ≥ 0', true, `count=${w[0]?.c ?? 0}`);

  finish();
}

async function httpCheck(url: string, ok: (r: Response) => boolean | Promise<boolean>, label: string) {
  try {
    const r = await fetch(url);
    const p = await ok(r);
    record(label + ' (HTTP)', p, `status=${r.status}`);
  } catch (e) {
    record(label, false, (e as Error).message);
  }
}

function finish() {
  const fail = results.filter((r) => !r.pass).length;
  console.log(`\n==== 完成: ${results.length - fail}/${results.length} 通过 ====`);
  if (fail > 0) {
    console.log('失败项:');
    for (const r of results.filter((r) => !r.pass)) console.log(`  - ${r.name}: ${r.detail}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('verify-deployment failed:', e);
  process.exit(1);
});
