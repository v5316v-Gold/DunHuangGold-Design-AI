/**
 * Phase 9.25 · Model Registry 自动登记
 *
 * 把 16 设计类工作流所需的模型登记到 model_registry。
 * 实际模型文件需运维从 E:\ComfyUI\ComfyUI\models\ 校验路径 + SHA256。
 *
 * 数据源:docs/COMFYUI-WORKFLOW-DEPENDENCIES-2026-08-07.md
 *
 * 运行:node scripts/seed-models.ts
 */
import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { db } from '../src/db';

interface ModelSpec {
  id: string;            // model_registry.id
  name: string;
  type: 'base' | 'lora' | 'controlnet';
  baseModel?: string;
  filename: string;
  comfyuiCategory: string;
  /** 实际校验留运维, 这里填 0 占位 */
  fileSize?: number;
  sha256?: string;
  /** 此模型被哪些 workflows 引用(反向引用) */
  referencedBy: Array<{ workflowId: string; active?: boolean }>;
}

const MODELS: ModelSpec[] = [
  // ===== 基础模型(Checkpoint)=====
  {
    id: 'mr-sdxl-base-1.0',
    name: 'SDXL Base 1.0',
    type: 'base',
    filename: 'sd_xl_base_1.0.safetensors',
    comfyuiCategory: 'checkpoints',
    referencedBy: [
      { workflowId: 'wf-text2img', active: false },
      { workflowId: 'wf-refine', active: false },
      { workflowId: 'wf-blend', active: false },
      { workflowId: 'wf-multiview', active: false },
      { workflowId: 'wf-sketch', active: false },
    ],
  },
  {
    id: 'mr-sd15-base',
    name: 'SD 1.5 Base',
    type: 'base',
    filename: 'v1-5-pruned-emaonly.safetensors',
    comfyuiCategory: 'checkpoints',
    referencedBy: [
      { workflowId: 'wf-removebg', active: false },
      { workflowId: 'wf-watermark', active: false },
    ],
  },

  // ===== LoRA =====
  {
    id: 'mr-lora-dunhuang-style',
    name: '敦煌风格 LoRA',
    type: 'lora',
    baseModel: 'SDXL',
    filename: 'dunhuang_style.safetensors',
    comfyuiCategory: 'loras',
    referencedBy: [{ workflowId: 'wf-text2img', active: false }],
  },
  {
    id: 'mr-lora-jewelry',
    name: '珠宝产品 LoRA',
    type: 'lora',
    baseModel: 'SDXL',
    filename: 'jewelry_product.safetensors',
    comfyuiCategory: 'loras',
    referencedBy: [{ workflowId: 'wf-refine', active: false }],
  },
  {
    id: 'mr-lora-blend-multiview',
    name: '多图融合/多视图 LoRA',
    type: 'lora',
    baseModel: 'SDXL',
    filename: 'blend_multiview.safetensors',
    comfyuiCategory: 'loras',
    referencedBy: [
      { workflowId: 'wf-blend', active: false },
      { workflowId: 'wf-multiview', active: false },
    ],
  },
  {
    id: 'mr-lora-sketch',
    name: '线稿写实 LoRA',
    type: 'lora',
    baseModel: 'SDXL',
    filename: 'sketch_realistic.safetensors',
    comfyuiCategory: 'loras',
    referencedBy: [{ workflowId: 'wf-sketch', active: false }],
  },
  {
    id: 'mr-lora-free',
    name: '自由创作 LoRA',
    type: 'lora',
    baseModel: 'SDXL',
    filename: 'free_creative.safetensors',
    comfyuiCategory: 'loras',
    referencedBy: [{ workflowId: 'wf-free', active: false }],
  },
  {
    id: 'mr-lora-oneclick',
    name: '一键设计 LoRA',
    type: 'lora',
    baseModel: 'SDXL',
    filename: 'oneclick_design.safetensors',
    comfyuiCategory: 'loras',
    referencedBy: [{ workflowId: 'wf-oneclick', active: false }],
  },

  // ===== 3D / 雕塑 =====
  {
    id: 'mr-3d-sculpture-1',
    name: '雕塑模型 A',
    type: 'base',
    filename: 'sculpture_model_a.safetensors',
    comfyuiCategory: 'checkpoints',
    referencedBy: [{ workflowId: 'wf-2dto3d', active: false }],
  },
  {
    id: 'mr-3d-sculpture-2',
    name: '雕塑模型 B',
    type: 'base',
    filename: 'sculpture_model_b.safetensors',
    comfyuiCategory: 'checkpoints',
    referencedBy: [{ workflowId: 'wf-2dto3d', active: false }],
  },
  {
    id: 'mr-3d-relief',
    name: '浮雕模型',
    type: 'base',
    filename: 'relief_model.safetensors',
    comfyuiCategory: 'checkpoints',
    referencedBy: [{ workflowId: 'wf-2dto3d', active: false }],
  },

  // ===== 视频(文生视频/图生视频)=====
  {
    id: 'mr-video-text2video-a',
    name: '视频生成模型 A',
    type: 'base',
    filename: 'video_t2v_a.safetensors',
    comfyuiCategory: 'checkpoints',
    referencedBy: [{ workflowId: 'wf-text2video', active: false }],
  },
  {
    id: 'mr-video-i2v-b',
    name: '图生视频模型 B',
    type: 'base',
    filename: 'video_i2v_b.safetensors',
    comfyuiCategory: 'checkpoints',
    referencedBy: [{ workflowId: 'wf-img2video', active: false }],
  },
  {
    id: 'mr-video-common',
    name: '视频通用模型',
    type: 'base',
    filename: 'video_common.safetensors',
    comfyuiCategory: 'checkpoints',
    referencedBy: [
      { workflowId: 'wf-text2video', active: false },
      { workflowId: 'wf-img2video', active: false },
    ],
  },

  // ===== Upscale / Inpaint =====
  {
    id: 'mr-upscale-4x',
    name: '4x UltraSharp Upscaler',
    type: 'base',
    filename: '4x-UltraSharp.pth',
    comfyuiCategory: 'upscale_models',
    referencedBy: [{ workflowId: 'wf-upscale', active: false }],
  },
  {
    id: 'mr-inpaint-watermark',
    name: '水印修复 Inpaint',
    type: 'base',
    filename: 'inpaint_watermark.safetensors',
    comfyuiCategory: 'checkpoints',
    referencedBy: [{ workflowId: 'wf-watermark', active: false }],
  },

  // ===== ControlNet =====
  {
    id: 'mr-controlnet-canny',
    name: 'Canny ControlNet',
    type: 'controlnet',
    baseModel: 'SD1.5',
    filename: 'control_v11p_sd15_canny.pth',
    comfyuiCategory: 'controlnet',
    referencedBy: [{ workflowId: 'wf-sketch', active: false }],
  },
  {
    id: 'mr-controlnet-depth',
    name: 'Depth ControlNet',
    type: 'controlnet',
    baseModel: 'SD1.5',
    filename: 'control_v11f1p_sd15_depth.pth',
    comfyuiCategory: 'controlnet',
    referencedBy: [{ workflowId: 'wf-2dto3d', active: false }],
  },
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

  console.log('🌱 Phase 9.25 · Model Registry 自动登记\n');
  console.log(`将登记 ${MODELS.length} 个模型(基础 + LoRA + ControlNet)\n`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const m of MODELS) {
    try {
      const existing = await db.execute(sql`
        SELECT id FROM model_registry WHERE id = ${m.id} LIMIT 1
      `);

      const refJson = JSON.stringify(m.referencedBy);
      const metadata = JSON.stringify({ source: 'Phase 9.25 seed', syncedAt: new Date().toISOString() });

      if (existing.rows && existing.rows.length > 0) {
        // 更新
        await db.execute(sql`
          UPDATE model_registry
          SET name = ${m.name},
              type = ${m.type},
              base_model = ${m.baseModel ?? null},
              filename = ${m.filename},
              comfyui_category = ${m.comfyuiCategory},
              referenced_by = ${refJson}::jsonb,
              metadata = ${metadata}::jsonb,
              updated_at = NOW()
          WHERE id = ${m.id}
        `);
        console.log(`  ↻  ${m.id.padEnd(28)} ${m.type.padEnd(10)} ${m.name}`);
        updated++;
      } else {
        // 新增
        await db.execute(sql`
          INSERT INTO model_registry (
            id, name, type, base_model, filename, file_size,
            sha256, status, comfyui_category, referenced_by, metadata
          ) VALUES (
            ${m.id}, ${m.name}, ${m.type}, ${m.baseModel ?? null},
            ${m.filename}, ${m.fileSize ?? 0}, ${m.sha256 ?? null},
            ${'available'}, ${m.comfyuiCategory},
            ${refJson}::jsonb, ${metadata}::jsonb
          )
        `);
        console.log(`  ✅ ${m.id.padEnd(28)} ${m.type.padEnd(10)} ${m.name}`);
        inserted++;
      }
    } catch (err) {
      console.error(`  ❌ ${m.id} 失败: ${(err as Error).message}`);
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`  新增: ${inserted}`);
  console.log(`  更新: ${updated}`);
  console.log(`  跳过: ${skipped}`);
  console.log(`  总计: ${MODELS.length} 个模型记录(available state)`);
  console.log(`\n📋 后续步骤(运维):`);
  console.log(`  1. 校验每个模型的实际文件路径:ls E:\\ComfyUI\\ComfyUI\\models\\<category>\\`);
  console.log(`  2. 计算 SHA256:Get-FileHash -Algorithm SHA256 <file>`);
  console.log(`  3. 更新 model_registry 的 sha256 / fileSize / referencedBy`);
  console.log(`  4. disabled/available 状态切换:DELETE /api/admin/model-registry/[id] PATCH action='disable'`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
