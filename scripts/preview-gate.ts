/**
 * scripts/preview-gate.ts
 *
 * 站在 lib/comfyui/workflow-gate.ts 的角度,模拟"上传 + 8 项门禁"全过程,
 * 看 runGate 实际行为是否符合预期(不写库,只本地评估)。
 *
 * 用法:
 *   pnpm tsx scripts/preview-gate.ts <featureId>
 *   pnpm tsx scripts/preview-gate.ts text2img
 */
import { promises as fs } from 'fs';
import { join } from 'path';
import { runGate } from '@/lib/comfyui/workflow-gate';
import { getCurrentUser } from '@/lib/auth';
import { NextRequest } from 'next/server';

const arg = process.argv[2] || 'text2img';

const file = join(process.cwd(), 'assets', 'comfyui-workflows', `${arg}.json`);
let workflowJson: Record<string, unknown> = {};
try {
  workflowJson = JSON.parse(await fs.readFile(file, 'utf-8'));
} catch (e) {
  console.error('读取 workflow 失败:', (e as Error).message);
  process.exit(1);
}

console.log(`==== 8 项门禁预览: ${arg} ====`);
console.log(`文件: ${file}  节点数: ${Object.keys(workflowJson).length}`);

const report = await runGate({
  workflowId: `${arg}-comfyui`,
  workflowVersionId: `${arg}-preview`,
  workflowJson,
  inputMapping: { prompt: ['6', 0] },
  outputMapping: { image: ['9', 0] },
  featureId: arg,
  connectionHost: process.env.COMFYUI_HOST || 'http://host.docker.internal:8188',
  skipDryRun: !!(process.env.SKIP_DRYRUN === '1'),
});

console.log('\n[items]');
for (const i of report.items) {
  const tag = i.status === 'pass' ? '✓' : i.status === 'fail' ? '✗' : '~';
  console.log(`  [${tag}] ${i.name}  ${i.message || ''}`);
}
console.log(`\n[overall] pass=${report.overallPass}  blockers=${report.blockers.join(',')}`);
process.exit(report.overallPass ? 0 : 1);
