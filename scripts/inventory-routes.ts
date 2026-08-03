/**
 * Phase 0.2: 92 路由清单生成器
 * 输出: docs/MIGRATION/PHASE-0-route-inventory.csv
 *
 * 列:
 *  path, methods, auth_required, input_source, output_shape,
 *  service_called, imports_db, imports_redis, imports_comfyui,
 *  bypasses_orchestrator, replacement_target, compat_status
 */
import * as fs from 'fs';
import * as path from 'path';

interface RouteInfo {
  filePath: string;
  urlPath: string;
  methods: string[];
  authRequired: boolean;
  isAdmin: boolean;
  importsDb: boolean;
  importsRedis: boolean;
  importsComfyui: boolean;
  importsBullmq: boolean;
  importsWorkflow: boolean;
  bypassesOrchestrator: boolean;
}

async function main() {
  const apiDir = path.join(process.cwd(), 'src/app/api');
  const routeFiles: string[] = [];

  function walk(dir: string) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name === 'route.ts') routeFiles.push(p);
    }
  }
  walk(apiDir);

  const rows: RouteInfo[] = [];
  for (const f of routeFiles) {
    const text = fs.readFileSync(f, 'utf8');

    // URL 路径
    const relPath = path.relative(path.join(process.cwd(), 'src/app/api'), path.dirname(f));
    const urlPath = '/api/' + relPath.replace(/\\/g, '/');

    // HTTP 方法
    const methods: string[] = [];
    if (/export\s+(async\s+)?function\s+GET/.test(text)) methods.push('GET');
    if (/export\s+(async\s+)?function\s+POST/.test(text)) methods.push('POST');
    if (/export\s+(async\s+)?function\s+PUT/.test(text)) methods.push('PUT');
    if (/export\s+(async\s+)?function\s+PATCH/.test(text)) methods.push('PATCH');
    if (/export\s+(async\s+)?function\s+DELETE/.test(text)) methods.push('DELETE');

    // 违规检测
    const importsDb = /from\s+['"]@?(\/storage\/database|@\/db)/.test(text) ||
                       /from\s+['"]drizzle-orm/.test(text);
    const importsRedis = /from\s+['"]ioredis/.test(text);
    const importsComfyui = /from\s+['"]@?\/lib\/comfyui-service/.test(text);
    const importsBullmq = /from\s+['"]bullmq/.test(text);
    const importsWorkflow = /workflow_templates|JSON\s+stringify.*workflow/.test(text);

    const authRequired = /requireAuth|requireAdmin|user\?\.role/.test(text);
    const isAdmin = /requireAdmin|role\s*===?\s*['"]admin['"]/.test(text);

    // 直接调用 ComfyUI/checkHealth（绕过 orchestrator）
    const bypassesOrchestrator = /checkComfyUIHealth|submittPrompt|imageTo3D|removeBackground|sketchToRealistic/.test(text) &&
                                    !text.includes('orchestrator');

    rows.push({
      filePath: path.relative(process.cwd(), f),
      urlPath,
      methods,
      authRequired,
      isAdmin,
      importsDb,
      importsRedis,
      importsComfyui,
      importsBullmq,
      importsWorkflow,
      bypassesOrchestrator,
    });
  }

  // 输出 CSV
  const headers = [
    'path', 'methods', 'auth_required', 'is_admin',
    'imports_db', 'imports_redis', 'imports_comfyui', 'imports_bullmq', 'imports_workflow',
    'bypasses_orchestrator',
    'replacement_target', 'compat_status',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const replacementTarget = r.urlPath
      .replace('/api/', '/api/v1/')
      .replace('/admin/', '/admin/');  // admin 保留
    lines.push([
      r.urlPath,
      r.methods.join('|'),
      String(r.authRequired),
      String(r.isAdmin),
      String(r.importsDb),
      String(r.importsRedis),
      String(r.importsComfyui),
      String(r.importsBullmq),
      String(r.importsWorkflow),
      String(r.bypassesOrchestrator),
      replacementTarget,
      'pending',
    ].join(','));
  }

  const outDir = path.join(process.cwd(), 'docs/MIGRATION');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'PHASE-0-route-inventory.csv');
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`✅ ${rows.length} 个路由清单已写入: ${outPath}`);

  // 统计
  const total = rows.length;
  const byMethod = rows.reduce((acc, r) => {
    for (const m of r.methods) acc[m] = (acc[m] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const bypass = rows.filter(r => r.bypassesOrchestrator).length;
  const auth = rows.filter(r => r.authRequired).length;
  const admin = rows.filter(r => r.isAdmin).length;

  console.log(`\n--- 统计 ---`);
  console.log(`总路由: ${total}`);
  console.log(`按方法: ${JSON.stringify(byMethod)}`);
  console.log(`需鉴权: ${auth}`);
  console.log(`admin: ${admin}`);
  console.log(`绕过编排器（违规）: ${bypass}`);
}

main().catch((e) => { console.error(e); process.exit(1); });