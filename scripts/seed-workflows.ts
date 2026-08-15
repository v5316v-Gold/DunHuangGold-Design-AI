/**
 * Phase 9.25 · Workflow Registry 自动初始化
 *
 * 为 16 设计类功能自动创建 comfyui_configs 记录(lifecycle='draft'),
 * 管理员后续只需:
 *   1. 通过后台 UI 上传 workflow JSON(替换 stub)
 *   2. 触发 8 项发布门禁
 *   3. 设为 Active Version → lifecycle='active'
 *
 * 数据源:docs/COMFYUI-WORKFLOW-DEPENDENCIES-2026-08-07.md
 *
 * 运行:node scripts/seed-workflows.ts
 *       (依赖 DATABASE_URL 环境变量)
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db';

interface WorkflowSpec {
  id: string;          // comfyui_configs.id(短)
  featureId: string;   // 绑定 features.id
  name: string;        // 显示名
  description: string;
  priority: number;    // 1=⭐, 2=⭐⭐, 3=⭐⭐⭐
  nodeCount: number;   // 节点数
  modelsMissing: number; // 缺模型数
  fieldsMissing: number; // 缺字段数
  notes: string;
}

const SPECS: WorkflowSpec[] = [
  { id: 'wf-relief',    featureId: 'relief',    name: '图转浮雕图',  description: 'ImageFilterEmboss 风格, 纯图片无模型', priority: 1, nodeCount: 5,  modelsMissing: 0, fieldsMissing: 1, notes: '修复 ImageToMask.channel 默认值' },
  { id: 'wf-image3d',   featureId: 'image3d',   name: '图转3D模型',  description: 'ImageTo3D 节点, 零模型依赖',          priority: 1, nodeCount: 3,  modelsMissing: 0, fieldsMissing: 1, notes: '基础可用, 高级需额外模型' },
  { id: 'wf-2dto3d',    featureId: '2dto3d',    name: '平面转雕塑',  description: '10 节点齐全, 缺 3 模型',                priority: 2, nodeCount: 10, modelsMissing: 3, fieldsMissing: 0, notes: '需下载 3 个雕塑模型' },
  { id: 'wf-text2img',  featureId: 'text2img',  name: '文案生图',    description: 'CheckpointLoaderSimple + 7 节点',       priority: 2, nodeCount: 7,  modelsMissing: 1, fieldsMissing: 0, notes: 'Checkpoint 配齐后可跑' },
  { id: 'wf-refine',    featureId: 'refine',    name: '产品精修',    description: 'Img2Img 风格, 10 节点',                  priority: 2, nodeCount: 10, modelsMissing: 1, fieldsMissing: 1, notes: '需 1 模型 + 1 字段修复' },
  { id: 'wf-blend',     featureId: 'blend',     name: '多图融合',    description: '12 节点齐全, 缺 2 模型',                priority: 2, nodeCount: 12, modelsMissing: 2, fieldsMissing: 1, notes: '需 2 张量模型' },
  { id: 'wf-oneclick',  featureId: 'oneclick',  name: '一键设计',    description: '一键生成, 10 节点',                       priority: 2, nodeCount: 10, modelsMissing: 1, fieldsMissing: 0, notes: '需 1 模型' },
  { id: 'wf-multiview', featureId: 'multiview', name: '生成多视图',  description: '10 节点, 缺 1 模型',                     priority: 2, nodeCount: 10, modelsMissing: 1, fieldsMissing: 0, notes: '需多视角模型' },
  { id: 'wf-sketch',    featureId: 'sketch',    name: '线稿/写实',   description: '11 节点, 缺 2 模型',                     priority: 2, nodeCount: 11, modelsMissing: 2, fieldsMissing: 0, notes: '需 2 ControlNet/LoRA' },
  { id: 'wf-free',      featureId: 'free',      name: '自由创作区',  description: '12 节点, 缺 2 模型 + 4 字段',           priority: 3, nodeCount: 12, modelsMissing: 2, fieldsMissing: 4, notes: '通用, 字段需补' },
  { id: 'wf-text2video', featureId: 'text2video', name: '文生视频',   description: '8 节点, 缺 3 模型 + 8 字段',           priority: 3, nodeCount: 8,  modelsMissing: 3, fieldsMissing: 8, notes: '需 kijai/ComfyUI-WanVideoWrapper 或替代' },
  { id: 'wf-img2video', featureId: 'img2video', name: '图生视频',     description: '9 节点, 缺 3 模型 + 9 字段',           priority: 3, nodeCount: 9,  modelsMissing: 3, fieldsMissing: 9, notes: '同上' },
  { id: 'wf-removebg',  featureId: 'removebg',  name: '移除背景',    description: 'rembg 节点, 3 节点齐全',                  priority: 1, nodeCount: 3,  modelsMissing: 0, fieldsMissing: 0, notes: '可立即跑' },
  { id: 'wf-upscale',   featureId: 'upscale',   name: '高清放大',    description: 'upscale 模型, 4 节点',                    priority: 2, nodeCount: 4,  modelsMissing: 1, fieldsMissing: 0, notes: '需 upscale 模型' },
  { id: 'wf-watermark', featureId: 'watermark', name: '去除水印',    description: '11 节点, 缺 1 模型 + 1 字段',          priority: 2, nodeCount: 11, modelsMissing: 1, fieldsMissing: 1, notes: '需 inpaint 模型' },
  { id: 'wf-tryon',     featureId: 'tryon',     name: '佩戴效果',    description: '5 节点, 缺 2 字段',                       priority: 2, nodeCount: 5,  modelsMissing: 0, fieldsMissing: 2, notes: '字段修复后可用' },
];

async function main() {
  if (!db) {
    console.error('❌ DATABASE_URL 未配置');
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL 未配置');
    process.exit(1);
  }

  console.log('🌱 Phase 9.25 · Workflow Registry 自动初始化\n');
  console.log(`配置 16 个 workflow_configs(lifecycle='draft')\n`);

  let inserted = 0;
  let skipped = 0;

  for (const spec of SPECS) {
    try {
      // 检查是否已存在
      const existing = await db.execute(sql`
        SELECT id FROM comfyui_configs WHERE id = ${spec.id} LIMIT 1
      `);

      if (existing.rows && existing.rows.length > 0) {
        console.log(`  ⏭️  ${spec.id} (${spec.featureId}) 已存在,跳过`);
        skipped++;
        continue;
      }

      // 创建 stub workflow config
      // workflow_json = 空,管理员后续上传;默认 dry-run 配置
      await db.execute(sql`
        INSERT INTO comfyui_configs (
          id, feature_id, workflow_id, workflow_json,
          node_mapping, default_params, fixed_params, connection_id,
          enabled, is_default, description, lifecycle, name
        ) VALUES (
          ${spec.id}, ${spec.featureId}, ${null}, ${'{}'}::jsonb,
          ${'{}'}::jsonb, ${'{}'}::jsonb, ${'{}'}::jsonb, ${null},
          ${false}, ${false}, ${spec.description}, ${'draft'}, ${spec.name}
        )
      `);

      console.log(`  ✅ ${spec.id.padEnd(16)} ${spec.featureId.padEnd(12)} ${spec.name.padEnd(10)} ⭐`.repeat(1) + ' created');
      inserted++;
    } catch (err) {
      console.error(`  ❌ ${spec.id} 失败: ${(err as Error).message}`);
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`  新增: ${inserted}`);
  console.log(`  跳过: ${skipped}`);
  console.log(`  总计: ${SPECS.length} 个 workflow_config 记录(draft 状态)`);
  console.log(`\n📋 后续步骤(运维):`);
  console.log(`  1. 登录后台 → /admin/api-settings → 本地 ComfyUI → 工作流配置`);
  console.log(`  2. 每个功能:上传 JSON → 自动跑 8 项发布门禁 → 设 Active Version`);
  console.log(`  3. Active 后 lifecycle='active',用户即可调用`);
  console.log(`  4. 快速通道:跑 scripts/test-16-features.ts 自动触发`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
