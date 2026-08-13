/**
 * 导入 ComfyUI 工作流到数据库（UI 格式 → API 格式 → comfyui_configs 表）
 *
 * 用法：
 *   npx tsx scripts/import-comfyui-workflow.ts <workflow名> <featureId>
 *   示例:
 *   npx tsx scripts/import-comfyui-workflow.ts "Qwen雕塑工作流" relief
 *   npx tsx scripts/import-comfyui-workflow.ts "Qwen高清修复工作流" upscale
 *   npx tsx scripts/import-comfyui-workflow.ts "图生3D模型工作流" image3d
 *   npx tsx scripts/import-comfyui-workflow.ts "图生图工作流" refine
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://dunhuang1:dunhuang2026@localhost:5432/dunhuang';

const WORKFLOW_DIR =
  process.env.COMFYUI_WORKFLOW_DIR ||
  path.join('E:', 'ComfyUI', 'ComfyUI', 'user', 'default', 'workflows');

/**
 * 工作流名 → featureId 映射
 * 优先匹配长名（防止 "图生图" 误匹配 "图生3D"）
 */
const WORKFLOW_TO_FEATURE: Record<string, string> = {
  'Qwen雕塑工作流': 'relief',
  'Qwen高清修复工作流': 'upscale',
  'Qwen高清修复工作流-watermark': 'watermark',  // 同工作流用于水印
  '图生3D模型工作流': 'image3d',
  '图生3D模型工作流-2dto3d': '2dto3d',
  '图生图工作流': 'refine',
  '图生图工作流-blend': 'blend',
  '图生图工作流-oneclick': 'oneclick',
  '图生图工作流-multiview': 'multiview',
  '图生图工作流-sketch': 'sketch',
  '图生图工作流-free': 'free',
  'STLandVSM': 'removebg',  // STL/VSM 转换借用为去背景
};

/**
 * 工作流 → nodeMapping 映射（LoadImage 节点 id + 提示词节点 id）
 */
const WORKFLOW_NODE_MAPPING: Record<string, Record<string, string>> = {
  'Qwen雕塑工作流':         { inputImage: '93' },
  'Qwen高清修复工作流':     { inputImage: '93' },
  'Qwen高清修复工作流-watermark': { inputImage: '93' },
  '图生3D模型工作流':       { inputImage: '99' },
  '图生3D模型工作流-2dto3d': { inputImage: '99' },
  '图生图工作流':           { inputImage: '41' },
  '图生图工作流-blend':      { inputImage: '41' },
  '图生图工作流-oneclick':   { inputImage: '41' },
  '图生图工作流-multiview':  { inputImage: '41' },
  '图生图工作流-sketch':     { inputImage: '41' },
  '图生图工作流-free':       { inputImage: '41' },
  'STLandVSM':              { inputImage: '10' },
};

/**
 * UI 格式 → API 格式转换（ComfyUI 标准算法）
 * 处理：widget 值分配（考虑已连接输入）、links 连接、_meta 保留
 */
function uiToApiFormat(uiData: any): Record<string, any> {
  const nodes = uiData.nodes;
  const links = uiData.links || [];

  // 建立节点 id → 节点 映射
  const nodeMap: Record<number, any> = {};
  for (const n of nodes) nodeMap[n.id] = n;

  // 计算每个节点哪些输入被 link 连接（target_input_name 由 link 决定）
  // links: [id, origin_id, origin_slot, target_id, target_slot, type]
  const targetLinks: Record<number, { linkId: number; originId: number; originSlot: number; type: string }[]> = {};
  for (const link of links) {
    const [linkId, originId, originSlot, targetId, targetSlot, type] = link;
    if (!targetLinks[targetId]) targetLinks[targetId] = [];
    targetLinks[targetId].push({ linkId, originId, originSlot, type });
  }

  const api: Record<string, any> = {};

  for (const n of nodes) {
    const nid = n.id;
    const classType = n.type;
    const inputDefs = n.inputs || [];
    const widgets = (n.widgets_values || []).slice();
    const connectedInputs = targetLinks[nid] || [];

    // 收集被连接的 input 名字
    const connectedNames = new Set<string>();
    for (const cl of connectedInputs) {
      for (const inp of inputDefs) {
        if (inp.link === cl.linkId) {
          connectedNames.add(inp.name);
          break;
        }
      }
    }

    const inputs: Record<string, any> = {};
    let widgetIdx = 0;

    // 第一遍：分配 widget 值（跳过已连接的输入）
    for (const inp of inputDefs) {
      if (!inp.widget) continue;
      if (connectedNames.has(inp.name)) continue;
      if (widgetIdx < widgets.length) {
        inputs[inp.name] = widgets[widgetIdx];
        widgetIdx++;
      }
    }

    // 第二遍：处理连接输入
    for (const cl of connectedInputs) {
      for (const inp of inputDefs) {
        if (inp.link === cl.linkId) {
          inputs[inp.name] = [String(cl.originId), cl.originSlot];
          break;
        }
      }
    }

    // 第三遍：额外 widgets（如 KSampler 多参数）——跳过已用
    // （部分节点的 widget 数量 > 非连接输入数，多余的忽略，交给 default）

    api[String(nid)] = {
      class_type: classType,
      inputs,
      _meta: { title: n.title || '' },
    };
  }

  return api;
}

async function main() {
  const args = process.argv.slice(2);

  // 模式 1: 批量导入所有 (无参数)
  // 模式 2: 指定工作流 <wfName> <featureId>
  const isBatch = args.length === 0;

  // 准备导入计划
  const plans: { wfName: string; featureId: string; nodeMapping: Record<string, string> }[] = [];
  if (isBatch) {
    // 批量：遍历 WORKFLOW_TO_FEATURE，对每条同源工作流找所有目标 feature
    const sourceWfs = new Set<string>();
    for (const k of Object.keys(WORKFLOW_TO_FEATURE)) {
      // 去掉 "-xxx" 后缀得到源工作流名
      const base = k.replace(/-[a-z0-9]+$/, '');
      sourceWfs.add(base);
    }
    for (const wfName of sourceWfs) {
      // 找所有以 wfName 开头的 feature 映射
      for (const [key, fid] of Object.entries(WORKFLOW_TO_FEATURE)) {
        if (key === wfName || key.startsWith(wfName + '-')) {
          plans.push({
            wfName,
            featureId: fid,
            nodeMapping: WORKFLOW_NODE_MAPPING[key] || WORKFLOW_NODE_MAPPING[wfName] || {},
          });
        }
      }
    }
  } else {
    const wfName = args[0];
    const featureId = args[1];
    if (!wfName || !featureId) {
      console.error('用法: npx tsx scripts/import-comfyui-workflow.ts [wfName featureId]');
      process.exit(1);
    }
    plans.push({ wfName, featureId, nodeMapping: WORKFLOW_NODE_MAPPING[wfName] || {} });
  }

  console.log(`📋 准备导入 ${plans.length} 个功能配置:\n`);
  for (const p of plans) {
    console.log(`  ${p.featureId.padEnd(12)} ← ${p.wfName} (inputImage→${p.nodeMapping.inputImage || 'N/A'})`);
  }
  console.log('');

  // 1. 连接 DB
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  // 2. 确保连接存在
  await client.query(
    `INSERT INTO comfyui_connections (id, name, host, port, enabled, is_default, priority, timeout)
     VALUES ('comfyui-local', '本地 ComfyUI', 'host.docker.internal', 8188, true, true, 0, 120000)
     ON CONFLICT (id) DO UPDATE SET host = EXCLUDED.host, enabled = true, is_default = true`
  );
  console.log('✅ ComfyUI 连接已配置\n');

  // 3. 按工作流分组（避免重复读取同一工作流）
  const wfCache: Record<string, { api: Record<string, any>; nodeCount: number }> = {};
  let successCount = 0;
  let skipCount = 0;

  for (const plan of plans) {
    // 读取+转换（缓存）
    if (!wfCache[plan.wfName]) {
      const wfPath = path.join(WORKFLOW_DIR, `${plan.wfName}.json`);
      if (!fs.existsSync(wfPath)) {
        console.log(`  ⚠️  ${plan.featureId}: 工作流文件不存在 ${wfPath}`);
        skipCount++;
        continue;
      }
      try {
        const uiData = JSON.parse(fs.readFileSync(wfPath, 'utf-8'));
        const api = uiToApiFormat(uiData);
        wfCache[plan.wfName] = { api, nodeCount: Object.keys(api).length };
      } catch (e: any) {
        console.log(`  ❌ ${plan.featureId}: 解析失败 - ${e.message}`);
        skipCount++;
        continue;
      }
    }
    const { api, nodeCount } = wfCache[plan.wfName];

    // 写入配置
    try {
      await client.query(`DELETE FROM comfyui_configs WHERE feature_id = $1`, [plan.featureId]);
      const workflowId = `${plan.featureId}-comfyui`;
      await client.query(
        `INSERT INTO comfyui_configs
           (id, feature_id, workflow_id, workflow_json, node_mapping, default_params, fixed_params, connection_id, enabled, is_default, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'comfyui-local', true, true, $8)
         ON CONFLICT (id) DO UPDATE SET
           workflow_json = EXCLUDED.workflow_json,
           node_mapping = EXCLUDED.node_mapping,
           default_params = EXCLUDED.default_params,
           fixed_params = EXCLUDED.fixed_params,
           enabled = true, is_default = true,
           description = EXCLUDED.description`,
        [
          workflowId,
          plan.featureId,
          plan.wfName,
          JSON.stringify(api),
          JSON.stringify(plan.nodeMapping),
          JSON.stringify({}),
          JSON.stringify({}),
          `${plan.featureId} ← ${plan.wfName} (${nodeCount} 节点)`,
        ]
      );
      console.log(`  ✅ ${plan.featureId.padEnd(12)} ← ${plan.wfName} (${nodeCount} 节点, LoadImage=${plan.nodeMapping.inputImage})`);
      successCount++;
    } catch (e: any) {
      console.log(`  ❌ ${plan.featureId}: 写入失败 - ${e.message}`);
      skipCount++;
    }
  }

  // 4. 最终统计
  const total = await client.query(`SELECT count(*) as cnt FROM comfyui_configs WHERE enabled = true`);
  console.log(`\n📊 总结:`);
  console.log(`  成功: ${successCount}`);
  console.log(`  跳过: ${skipCount}`);
  console.log(`  数据库 comfyui_configs 总数: ${total.rows[0].cnt}`);

  await client.end();
  console.log('\n🎉 批量导入完成！');
}

main().catch((e) => {
  console.error('❌ 导入失败:', e.message);
  console.error(e.stack);
  process.exit(1);
});
