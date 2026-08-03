/**
 * Phase 0.5: 架构边界分析
 * 扫描 src/, 输出每层违规导入
 */
import * as fs from 'fs';
import * as path from 'path';

interface Violation {
  file: string;
  line: number;
  rule: string;
  detail: string;
}

const rules = [
  { layer: 'L1', forbid: ['@/db', '@/storage/database', 'ioredis', 'bullmq', '@/workflow', '@/lib/ai-service/orchestrator', '@/lib/ai-gateway', '@/lib/queue', 'drizzle-orm', 'pg-client'] },
  { layer: 'L2', forbid: ['@/lib/comfyui-service', '@/workflow', 'bullmq', '@/lib/ai-gateway/adapters'] },
  { layer: 'L3', forbid: ['react', 'next/headers', 'next/cookie', '@/app/api'] },
  { layer: 'L4', forbid: ['react', 'next/headers', 'ai-gateway/port', 'ai-gateway/adapters'] },
  { layer: 'L5', forbid: ['@/db', 'drizzle-orm', '@/lib/auth', 'next/router'] },
];

function detectLayer(filePath: string): string | null {
  if (filePath.includes('/app/') && !filePath.includes('/api/')) return 'L1';
  if (filePath.includes('/app/api/')) return 'L2';
  if (filePath.includes('/lib/ai-service/') || filePath.includes('/lib/ai-gateway/') || filePath.includes('/lib/queue/') || filePath.includes('/lib/orchestrator/')) return 'L3';
  if (filePath.includes('/lib/db/') || filePath.includes('/lib/storage/') || filePath.includes('/config/')) return 'L4';
  if (filePath.includes('/worker/') || filePath.includes('/scripts/')) return 'L5';
  return null;
}

function walk(dir: string, files: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next' || ent.name === '.git' || ent.name === 'dist' || ent.name === 'coverage') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (/\.(ts|tsx)$/.test(ent.name)) files.push(p);
  }
  return files;
}

async function main() {
  const src = path.join(process.cwd(), 'src');
  const files = walk(src);

  const violations: Violation[] = [];
  const stats = { L1: 0, L2: 0, L3: 0, L4: 0, L5: 0, scanned: 0 };

  for (const f of files) {
    const rel = path.relative(process.cwd(), f);
    const layer = detectLayer(f);
    if (!layer) continue;
    stats.scanned++;
    stats[layer as keyof typeof stats]++;

    const text = fs.readFileSync(f, 'utf8');
    const lines = text.split('\n');

    const ruleSet = rules.find((r) => r.layer === layer);
    if (!ruleSet) continue;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const forbid of ruleSet.forbid) {
        if (line.includes(`from`) && line.includes(forbid)) {
          violations.push({
            file: rel,
            line: i + 1,
            rule: `${layer} → ${forbid}`,
            detail: line.trim().substring(0, 150),
          });
        }
      }
    }
  }

  const outDir = path.join(process.cwd(), 'docs/MIGRATION');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'PHASE-0-boundary-violations.md');

  let md = `# Phase 0 · Architecture Boundary Analysis\n\n`;
  md += `**Generated**: ${new Date().toISOString()}\n`;
  md += `**Spec**: 01-Architecture-Overview §4 (Dependency Rules)\n\n`;
  md += `## 1. File Layer Coverage (TS/TSX scanned in src/)\n\n| Layer | Files Scanned |\n|---|---:|\n`;
  for (const k of ['L1', 'L2', 'L3', 'L4', 'L5']) {
    md += `| ${k} | ${stats[k as keyof typeof stats]} |\n`;
  }
  md += `| **Total** | **${stats.scanned}** |\n\n`;

  md += `## 2. Violations (${violations.length})\n\n`;
  if (violations.length === 0) {
    md += `✅ No layer violations detected.\n\n`;
  } else {
    md += `### By Rule\n\n| Rule | Count |\n|---|---:|\n`;
    const byRule = violations.reduce((acc, v) => {
      acc[v.rule] = (acc[v.rule] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    for (const [rule, count] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
      md += `| ${rule} | ${count} |\n`;
    }
    md += `\n### Details (top 30)\n\n| File | Line | Rule | Detail |\n|---|---|---|---|\n`;
    for (const v of violations.slice(0, 30)) {
      md += `| ${v.file} | ${v.line} | \`${v.rule}\` | \`${v.detail}\` |\n`;
    }
  }

  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`✅ ${outPath}`);
  console.log(`违规数: ${violations.length}`);

  const csvPath = path.join(outDir, 'PHASE-0-boundary-violations.csv');
  const csv = ['file,line,rule,detail', ...violations.map((v) =>
    `"${v.file}",${v.line},"${v.rule}","${v.detail.replace(/"/g, '""')}"`
  )].join('\n');
  fs.writeFileSync(csvPath, csv, 'utf8');
  console.log(`✅ ${csvPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
