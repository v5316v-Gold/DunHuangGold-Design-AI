/**
 * scripts/bundle-workflows.ts
 *
 * 真实把 assets/comfyui-workflows/ 下 16 个 workflow JSON 在本地打包成一个
 * `comfyui_configs` upsert 批量 — 跑 8 项门禁 + 写 workflow_versions。
 *
 * 设计:
 *   1) 不依赖 web 路由,直接读 DB(因为 web 容器里的代码可能还未 rebuild)
 *   2) 使用真实的 8 项 gate(lib/comfyui/workflow-gate.runGate)
 *   3) 成功 = workflow_configs.active_version_id 指向新 version
 *
 * 用法:
 *   pnpm tsx scripts/bundle-workflows.ts
 *   BASE_URL=https://host pnpm tsx scripts/bundle-workflows.ts   # 通过 web API
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';
import { comfyuiConfigs, comfyuiConnections } from '@/db/schema/_tables';
import { features } from '@/db/schema/features';
import { eq } from 'drizzle-orm';
import { runGate } from '@/lib/comfyui/workflow-gate';
import { createWorkflowVersion, activateWorkflowVersion } from '@/lib/comfyui/workflow-gate';
import { promises as fs } from 'fs';
import { join } from 'path';

interface Spec {
  featureId: string;
  workflowFile: string;
  description: string;
  /** 自定义 output mapping */
  outputMapping: Record<string, unknown>;
  /** 自定义 input mapping */
  inputMapping: Record<string, unknown>;
  /** 默认参数 */
  defaultParams: Record<string, unknown>;
}

// 16 个 design features 都用真实的 minial workflow;comfyui_configs 行由 seed-comfyui-bindings 已经创建
// 包含: text2img / refine / blend / oneclick / multiview / sketch / free /
//        relief / image3d / 2dto3d / removebg / upscale / watermark /
//        tryon / text2video / img2video
//
// 对话(dialogue)由 HermesAgentExecutor 处理,不归 comfyui_configs
const SPECS: Spec[] = [
  // 13 个 R1 已存在的 binding(它们绑定的 workflowJSON 已在数据库里)
  { featureId: 'refine', workflowFile: 'text2img.json', description: '产品精修(共用 text2img workflow)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'blend', workflowFile: 'text2img.json', description: '多图融合(共用 text2img workflow)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'oneclick', workflowFile: 'text2img.json', description: '一键设计(共用 text2img workflow)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'multiview', workflowFile: 'text2img.json', description: '生成多视图(共用 text2img workflow)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'sketch', workflowFile: 'text2img.json', description: '线稿/写实(共用 text2img workflow)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'free', workflowFile: 'text2img.json', description: '自由创作区(共用 text2img workflow)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'relief', workflowFile: 'text2img.json', description: '图转浮雕图(共用 text2img workflow;Qwen 节点替换)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'image3d', workflowFile: 'text2img.json', description: '图转3D模型(共用 text2img workflow;TripoSplat 替换)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: '2dto3d', workflowFile: 'text2img.json', description: '平面转雕塑(共用)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'removebg', workflowFile: 'text2img.json', description: '移除背景(共用)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'upscale', workflowFile: 'text2img.json', description: '高清放大(共用)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'watermark', workflowFile: 'text2img.json', description: '去除水印(共用 upscale workflow)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  // 缺 4 行: 由 bundle-workflows 补上
  { featureId: 'text2img', workflowFile: 'text2img.json', description: '文案生图', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'tryon', workflowFile: 'text2img.json', description: '佩戴效果(共用)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'text2video', workflowFile: 'text2img.json', description: '文生视频(共用,演示阶段)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
  { featureId: 'img2video', workflowFile: 'text2img.json', description: '图生视频(共用,演示阶段)', outputMapping: { image: ['9', 0] }, inputMapping: { prompt: ['6', 0] }, defaultParams: { width: 1024, height: 1024 } },
];

async function main() {
  if (!db) {
    console.error('DB 不可用');
    process.exit(1);
  }

  const [conn] = await db.select().from(comfyuiConnections).where(eq(comfyuiConnections.isDefault, true)).limit(1);
  if (!conn) {
    console.error('未找到默认 ComfyUI connection (comfyui-local)');
    process.exit(1);
  }
  const connHost = `http://${conn.host}:${conn.port}`;

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const spec of SPECS) {
    const [f] = await db.select().from(features).where(eq(features.id, spec.featureId)).limit(1);
    if (!f) {
      console.log(`[skip] feature 不存在: ${spec.featureId}`);
      skipped += 1;
      continue;
    }
    const wfId = `${spec.featureId}-comfyui`;
    const filePath = join(process.cwd(), 'assets', 'comfyui-workflows', spec.workflowFile);
    let workflowJson: Record<string, unknown> = {};
    try {
      workflowJson = JSON.parse(await fs.readFile(filePath, 'utf-8'));
    } catch (e) {
      console.log(`[fail] ${spec.featureId} workflow 文件缺失: ${filePath}`);
      failed += 1;
      continue;
    }

    // 1) 写 comfyui_configs(不替换 executionCount)
    await db.execute(sql`
      INSERT INTO comfyui_configs (id, feature_id, workflow_id, workflow_json, node_mapping, default_params, fixed_params, connection_id, enabled, is_default, description, execution_count, last_executed_at, created_at, updated_at)
      VALUES (${wfId}, ${spec.featureId}, ${spec.workflowFile}, ${JSON.stringify(workflowJson)}::jsonb, ${JSON.stringify(spec.inputMapping)}::jsonb, ${JSON.stringify(spec.outputMapping)}::jsonb, '{}'::jsonb, ${conn.id}, true, true, ${spec.description}, 0, NULL, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET workflow_json = EXCLUDED.workflow_json, node_mapping = EXCLUDED.node_mapping, default_params = EXCLUDED.default_params, description = EXCLUDED.description, updated_at = NOW()
    `);

    // 2) 创建新 version
    const versionId = await createWorkflowVersion({
      workflowId: wfId,
      workflowJson,
      inputMapping: spec.inputMapping,
      outputMapping: spec.outputMapping,
      nodeMapping: spec.inputMapping,
      defaultParams: spec.defaultParams,
      fixedParams: {},
      changelog: 'bundle-upload via scripts/bundle-workflows.ts',
    });

    // 3) 跑 8 项门禁 + 升级 active
    try {
      const r = await activateWorkflowVersion({
        workflowId: wfId,
        workflowVersionId: versionId,
        featureId: spec.featureId,
        connectionHost: connHost,
      });
      if (r.success) {
        await db.execute(sql`UPDATE comfyui_configs SET active_version_id = ${versionId}, lifecycle = 'active', enabled = true, last_validation_at = NOW(), dependency_status = 'resolved' WHERE id = ${wfId}`);
        console.log(`  ✓ ${spec.featureId} → ${versionId} (active)`);
        ok += 1;
      } else {
        console.log(`  ✗ ${spec.featureId} 失败 blockers=${r.gateReport.blockers.join(',')}`);
        failed += 1;
      }
    } catch (e) {
      console.log(`  ✗ ${spec.featureId} 异常: ${(e as Error).message}`);
      failed += 1;
    }
  }

  console.log(`\n汇总: ok=${ok} skip=${skipped} failed=${failed}`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('bundle-workflows 异常:', e);
  process.exit(1);
});
