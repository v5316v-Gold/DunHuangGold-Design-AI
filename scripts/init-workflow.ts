import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../src/db/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:dhj5316@localhost:5432/dunhuang_design",
  ssl: false,
});
const db = drizzle(pool, { schema });

const sampleWorkflow = {
  nodes: {
    '1': {
      class_type: 'CLIPTextEncode',
      inputs: { text: 'prompt', clip: ['2', 0] }
    },
    '2': {
      class_type: 'CLIPLoader',
      inputs: { model_name: 'sd_xl_base_1.0.safetensors' }
    },
    '3': {
      class_type: 'KSampler',
      inputs: { model: ['2', 0], positive: ['1', 0], negative: ['4', 0], sampler_name: 'euler', steps: 20, cfg: 8, seed: 42, denoise: 1 }
    },
    '4': {
      class_type: 'CLIPTextEncode',
      inputs: { text: 'blurry, watermark, text, bad quality', clip: ['2', 0] }
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: { width: 1024, height: 1024, batch_size: 1 }
    },
    '6': {
      class_type: 'VAEDecode',
      inputs: { samples: ['3', 0], vae: ['2', 0] }
    },
    '7': {
      class_type: 'SaveImage',
      inputs: { images: ['6', 0], filename_prefix: 'dunhuang_ai' }
    }
  }
};

async function main() {
  try {
    // 先删除已存在的
    await db.delete(schema.workflows).where(eq(schema.workflows.id, 'image-generate'));
    
    // 再插入新的
    await db.insert(schema.workflows).values({
      id: 'image-generate',
      name: '图片生成',
      description: '基础文生图工作流，使用 Stable Diffusion XL',
      workflowJson: sampleWorkflow,
      comfyuiHost: 'http://localhost:8188',
      enabled: true,
    });
    console.log('✅ 工作流 image-generate 已创建');
  } catch (e: any) {
    console.error('❌ 错误:', e.message);
  } finally {
    await pool.end();
  }
}

import { eq } from 'drizzle-orm';
main();
