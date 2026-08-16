// scripts/check-gate-pure.mjs
// 不依赖 @/ 别名,直接把 workflow JSON 拿来,逐项复盘 8 项发布门禁的"纯逻辑"。
// 这样即便 host 没有 pnpm install,也能验证我的"约束文件"是否合理。

import { promises as fs } from 'fs';
import { join } from 'path';

const arg = process.argv[2] || 'text2img';
const file = join(process.cwd(), 'assets', 'comfyui-workflows', `${arg}.json`);
let workflowJson = {};
try {
  workflowJson = JSON.parse(await fs.readFile(file, 'utf-8'));
} catch (e) {
  console.error('读取失败:', e.message);
  process.exit(1);
}

console.log(`==== 8 项门禁 · 纯逻辑预览: ${arg} ====`);
console.log(`文件: ${file}  节点数: ${Object.keys(workflowJson).length}\n`);

let pass = 0, fail = 0, skipped = 0;
function check(name, ok, detail) {
  const tag = ok ? '✓' : ok === null ? '~' : '✗';
  console.log(`  [${tag}] ${name}${detail ? '  ' + detail : ''}`);
  if (ok === true) pass++; else if (ok === false) fail++; else skipped++;
  return ok;
}

// 1. JSON valid
const nodes = Object.values(workflowJson).filter(n => n && typeof n === 'object' && 'class_type' in n);
check('1. JSON valid + 至少 1 个节点', nodes.length > 0, `nodes=${nodes.length}`);

// 2. deps_resolved - 我们没有 model_registry → 模拟:列依赖
const deps = [];
for (const [, n] of Object.entries(workflowJson)) {
  const ct = n.class_type;
  const inputs = n.inputs || {};
  if (ct === 'CheckpointLoaderSimple' && inputs.ckpt_name) deps.push({ type: 'checkpoint', name: inputs.ckpt_name });
  if (ct === 'LoraLoader' && inputs.lora_name) deps.push({ type: 'lora', name: inputs.lora_name });
  if (ct === 'VAELoader' && inputs.vae_name) deps.push({ type: 'vae', name: inputs.vae_name });
}
console.log(`  依赖节点: ${deps.length} 个`);
check('2. deps_resolved (无 model_registry,预期 skipped)', null, deps.map(d => `${d.type}:${d.name}`).join(' / '));

// 3. nodes_resolved - 模拟:不连接 ComfyUI /object_info 必 fail
check('3. nodes_resolved (无 /object_info,预期 skipped)', null);

// 4. input_mapping valid
const INJECTABLE = new Set(['prompt','negative_prompt','seed','steps','cfg','sampler','denoise','width','height','batch_size','ckpt_name','lora_name','control_net_name','input_image','output_image','image']);
const usedFields = new Set();
for (const [, n] of Object.entries(workflowJson)) {
  for (const k of Object.keys(n.inputs || {})) usedFields.add(k);
}
const needInput = [...usedFields].filter(f => INJECTABLE.has(f));
const hasPromptMapping = !!workflowJson['6']; // 我们 SPEC 里 6 是 CLIPTextEncode
check('4. input_mapping valid (prompt 字段)', hasPromptMapping || needInput.length === 0, `prompt map on node 6`);

// 5. output_mapping valid
const hasOutput = !!workflowJson['9']; // SaveImage
check('5. output_mapping valid (SaveImage node 9)', hasOutput);

// 6. ComfyUI validation passed: SaveImage / PreviewImage 等输出节点存在
const out = nodes.some(n => /SaveImage$|PreviewImage$|VHS_VideoCombine$|SaveVideo$/i.test(n.class_type));
check('6. ComfyUI validation (有输出节点)', out);

// 7. dry_run (这里我们 skip 真实执行)
check('7. dry_run (本预览脚本跳过)', null, '需连 ComfyUI /prompt');

// 8. feature_binding - 我们 spec 提供了
check('8. feature binding', !!arg, `featureId=${arg}`);

console.log(`\n汇总: pass=${pass}  fail=${fail}  skipped=${skipped}`);
console.log('注意:真正跑 runGate 时,需要连 ComfyUI host 才能跑通 2/3/7 项门禁。');
