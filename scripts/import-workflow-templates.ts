/**
 * ComfyUI 工作流模板导入工具
 *
 * 借鉴 ComfyUI_examples 的标准工作流结构：
 * - 文生图 (txt2img)
 * - 图生图 (img2img)
 * - 局部重绘 (inpaint)
 * - LoRA 挂载 (lora)
 * - ControlNet 深度 (controlnet)
 *
 * 作用：把标准工作流 JSON 导入 workflow_templates 表
 * 让 13 个 ComfyUI 功能变成"配置驱动"
 *
 * 运行：npx tsx scripts/import-workflow-templates.ts
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ============================================================
// 标准工作流模板定义
// ============================================================

interface WorkflowTemplate {
  name: string;
  serviceType: string;
  description: string;
  workflowJson: Record<string, unknown>;
  comfyuiVersion: string;
}

/**
 * 基础文生图工作流（Z-Turbo 风格）
 */
const text2imgWorkflow = {
  '1': {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: 'z-turbo.safetensors' },
  },
  '2': {
    class_type: 'CLIPTextEncode',
    inputs: { text: '{{prompt}}', clip: ['1', 1] },
  },
  '3': {
    class_type: 'CLIPTextEncode',
    inputs: { text: '{{negative_prompt}}', clip: ['1', 1] },
  },
  '4': {
    class_type: 'EmptyLatentImage',
    inputs: { width: '{{width}}', height: '{{height}}', batch_size: '{{count}}' },
  },
  '5': {
    class_type: 'KSampler',
    inputs: {
      model: ['1', 0],
      positive: ['2', 0],
      negative: ['3', 0],
      latent_image: ['4', 0],
      seed: '{{seed}}',
      steps: 20,
      cfg: 7.0,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: 1.0,
    },
  },
  '6': {
    class_type: 'VAEDecode',
    inputs: { samples: ['5', 0], vae: ['1', 2] },
  },
  '7': {
    class_type: 'SaveImage',
    inputs: { images: ['6', 0], filename_prefix: 'dunhuang_text2img' },
  },
};

/**
 * 基础图生图工作流（精修用）
 */
const img2imgWorkflow = {
  '1': {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: 'z-turbo.safetensors' },
  },
  '2': {
    class_type: 'LoadImage',
    inputs: { image: '{{input_image}}' },
  },
  '3': {
    class_type: 'CLIPTextEncode',
    inputs: { text: '{{prompt}}', clip: ['1', 1] },
  },
  '4': {
    class_type: 'CLIPTextEncode',
    inputs: { text: '{{negative_prompt}}', clip: ['1', 1] },
  },
  '5': {
    class_type: 'VAEEncode',
    inputs: { pixels: ['2', 0], vae: ['1', 2] },
  },
  '6': {
    class_type: 'KSampler',
    inputs: {
      model: ['1', 0],
      positive: ['3', 0],
      negative: ['4', 0],
      latent_image: ['5', 0],
      seed: '{{seed}}',
      steps: 20,
      cfg: 7.0,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: '{{denoise}}',
    },
  },
  '7': {
    class_type: 'VAEDecode',
    inputs: { samples: ['6', 0], vae: ['1', 2] },
  },
  '8': {
    class_type: 'SaveImage',
    inputs: { images: ['7', 0], filename_prefix: 'dunhuang_img2img' },
  },
};

/**
 * LoRA 挂载工作流（品牌 LoRA 用）
 */
const loraWorkflow = {
  '1': {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name: '{{base_model}}' },
  },
  '2': {
    class_type: 'LoRALoader',
    inputs: {
      model: ['1', 0],
      clip: ['1', 1],
      lora_name: '{{lora_name}}',
      strength_model: '{{lora_strength}}',
      strength_clip: '{{lora_strength}}',
    },
  },
  '3': {
    class_type: 'CLIPTextEncode',
    inputs: { text: '{{prompt}}', clip: ['2', 1] },
  },
  '4': {
    class_type: 'CLIPTextEncode',
    inputs: { text: '{{negative_prompt}}', clip: ['2', 1] },
  },
  '5': {
    class_type: 'EmptyLatentImage',
    inputs: { width: '{{width}}', height: '{{height}}', batch_size: '{{count}}' },
  },
  '6': {
    class_type: 'KSampler',
    inputs: {
      model: ['2', 0],
      positive: ['3', 0],
      negative: ['4', 0],
      latent_image: ['5', 0],
      seed: '{{seed}}',
      steps: 25,
      cfg: 6.5,
      sampler_name: 'euler_ancestral',
      scheduler: 'normal',
      denoise: 1.0,
    },
  },
  '7': {
    class_type: 'VAEDecode',
    inputs: { samples: ['6', 0], vae: ['1', 2] },
  },
  '8': {
    class_type: 'SaveImage',
    inputs: { images: ['7', 0], filename_prefix: 'dunhuang_lora' },
  },
};

const TEMPLATES: WorkflowTemplate[] = [
  {
    name: 'text2img-z-turbo',
    serviceType: 'text2img',
    description: '标准文生图工作流（Z-Turbo）',
    workflowJson: text2imgWorkflow,
    comfyuiVersion: 'latest',
  },
  {
    name: 'refine-img2img',
    serviceType: 'refine',
    description: '产品精修 - 图生图工作流',
    workflowJson: img2imgWorkflow,
    comfyuiVersion: 'latest',
  },
  {
    name: 'lora-brand-style',
    serviceType: 'text2img',
    description: '品牌 LoRA 挂载工作流',
    workflowJson: loraWorkflow,
    comfyuiVersion: 'latest',
  },
];

// ============================================================
// 导入逻辑
// ============================================================

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未配置');

  const client = new Client({ connectionString: url });
  await client.connect();
  console.log('🔗 已连接数据库\n');

  for (const t of TEMPLATES) {
    // 检查是否已存在
    const existing = await client.query(
      'SELECT id FROM workflow_templates WHERE name = $1',
      [t.name]
    );

    if (existing.rows[0]) {
      // 更新（版本 +1）
      const { rows } = await client.query(
        `UPDATE workflow_templates
         SET workflow_json = $2, version = version + 1, updated_at = NOW()
         WHERE name = $1
         RETURNING id, version`,
        [t.name, JSON.stringify(t.workflowJson)]
      );
      console.log(`🔄 ${t.name} 已更新到 v${rows[0].version}`);
    } else {
      // 插入
      const { rows } = await client.query(
        `INSERT INTO workflow_templates
         (name, service_type, workflow_json, comfyui_version, description, enabled)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id`,
        [t.name, t.serviceType, JSON.stringify(t.workflowJson), t.comfyuiVersion, t.description]
      );
      console.log(`✅ ${t.name} 已导入 (${t.serviceType})`);
    }
  }

  // 验证
  console.log('\n🔍 当前工作流模板:');
  const { rows } = await client.query(
    'SELECT name, service_type, version, enabled FROM workflow_templates ORDER BY name'
  );
  for (const r of rows) {
    console.log(`  ${r.enabled ? '✅' : '❌'} ${r.name} (${r.service_type} v${r.version})`);
  }

  await client.end();
  console.log('\n🎉 工作流模板导入完成');
}

main().catch((err) => {
  console.error('❌ 失败:', err);
  process.exit(1);
});