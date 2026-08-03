/**
 * Seed features 表（V2 功能配置）
 *
 * 关键：ID 必须与前端 featureComponents 注册的 key 一致
 * 对照:
 *   frontend key      DB id
 *   text2img   →  text2img
 *   refine     →  refine        (不是 product-refine)
 *   blend      →  blend         (不是 multi-image)
 *   image3d    →  image3d       (不是 image-3d)
 *   oneclick   →  oneclick      (不是 one-click-design)
 *   multiview  →  multiview     (不是 multi-view)
 *   sketch     →  sketch        (不是 sketch-realistic)
 *   free       →  free          (不是 free-creation)
 *   text2video →  text2video
 *   img2video  →  img2video     (不是 image2video)
 *   removebg   →  removebg      (不是 remove-background)
 *   upscale    →  upscale
 *   watermark  →  watermark     (不是 remove-watermark)
 *   dialogue   →  dialogue      (不是 ai-chat)
 *   relief     →  relief
 *   tryon      →  tryon
 *   2dto3d     →  2dto3d
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const FEATURES = [
  { id: 'text2img', name: '文案生图', category: 'image', cost: 10, defaultExecutor: 'third-party', fallback: ['comfyui', 'mock'], sortOrder: 1, displayGroup: '灵感与创作', icon: 'Image' },
  { id: 'refine', name: '产品精修', category: 'image', cost: 15, defaultExecutor: 'third-party', fallback: ['comfyui', 'mock'], sortOrder: 2, displayGroup: '灵感与创作', icon: 'Sparkles' },
  { id: 'relief', name: '图转浮雕图', category: '3d', cost: 20, defaultExecutor: 'third-party', fallback: ['comfyui', 'mock'], sortOrder: 3, displayGroup: '浮雕圆雕', icon: 'Mountain' },
  { id: 'image3d', name: '图转3D模型', category: '3d', cost: 30, defaultExecutor: 'third-party', fallback: ['mock'], sortOrder: 4, displayGroup: '浮雕圆雕', icon: 'Box' },
  { id: '2dto3d', name: '平面转雕塑', category: '3d', cost: 25, defaultExecutor: 'third-party', fallback: ['comfyui', 'mock'], sortOrder: 5, displayGroup: '浮雕圆雕', icon: 'Layers' },
  { id: 'blend', name: '多图融合', category: 'image', cost: 15, defaultExecutor: 'third-party', fallback: ['comfyui', 'mock'], sortOrder: 6, displayGroup: '灵感与创作', icon: 'Blend' },
  { id: 'oneclick', name: '一键设计', category: 'image', cost: 15, defaultExecutor: 'third-party', fallback: ['comfyui', 'mock'], sortOrder: 7, displayGroup: '灵感与创作', icon: 'Wand2' },
  { id: 'multiview', name: '生成多视图', category: 'image', cost: 20, defaultExecutor: 'third-party', fallback: ['comfyui', 'mock'], sortOrder: 8, displayGroup: '灵感与创作', icon: 'Grid3X3' },
  { id: 'sketch', name: '线稿/写实', category: 'image', cost: 15, defaultExecutor: 'third-party', fallback: ['comfyui', 'mock'], sortOrder: 9, displayGroup: '灵感与创作', icon: 'PenTool' },
  { id: 'free', name: '自由创作区', category: 'image', cost: 15, defaultExecutor: 'third-party', fallback: ['comfyui', 'mock'], sortOrder: 10, displayGroup: '灵感与创作', icon: 'Palette' },
  { id: 'text2video', name: '文生视频', category: 'video', cost: 50, defaultExecutor: 'third-party', fallback: ['mock'], sortOrder: 11, displayGroup: '生成视频', icon: 'Video' },
  { id: 'img2video', name: '图生视频', category: 'video', cost: 40, defaultExecutor: 'third-party', fallback: ['mock'], sortOrder: 12, displayGroup: '生成视频', icon: 'Film' },
  { id: 'removebg', name: '移除背景', category: 'image', cost: 5, defaultExecutor: 'third-party', fallback: ['comfyui', 'mock'], sortOrder: 13, displayGroup: '实用工具', icon: 'Eraser' },
  { id: 'upscale', name: '高清放大', category: 'image', cost: 5, defaultExecutor: 'third-party', fallback: ['comfyui', 'mock'], sortOrder: 14, displayGroup: '实用工具', icon: 'Maximize2' },
  { id: 'watermark', name: '去除水印', category: 'image', cost: 5, defaultExecutor: 'third-party', fallback: ['comfyui', 'mock'], sortOrder: 15, displayGroup: '实用工具', icon: 'Droplet' },
  { id: 'dialogue', name: 'AI对话', category: 'chat', cost: 2, defaultExecutor: 'third-party', fallback: ['mock'], sortOrder: 16, displayGroup: '灵感与创作', icon: 'MessageSquare' },
  { id: 'tryon', name: '佩戴效果', category: 'image', cost: 25, defaultExecutor: 'third-party', fallback: ['mock'], sortOrder: 17, displayGroup: '实用工具', icon: 'Shirt' },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未配置');
  const client = new Client({ connectionString: url });
  await client.connect();
  console.log('🔗 已连接数据库\n');

  // 先清空（避免重复）
  await client.query('DELETE FROM features');
  console.log('🗑️ 已清空 features 表');

  let inserted = 0;
  for (const f of FEATURES) {
    await client.query(
      `INSERT INTO features
       (id, name, description, category, icon, cost, enabled, default_executor, fallback_executors, sort_order, display_group, supports_ai_assistant)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8::jsonb, $9, $10, $11)`,
      [f.id, f.name, `${f.name}功能`, f.category, f.icon, f.cost,
       f.defaultExecutor, JSON.stringify(f.fallback), f.sortOrder, f.displayGroup,
       f.id === 'dialogue' || f.id === 'ai-assistant']
    );
    inserted++;
    console.log(`✅ ${f.id} (${f.name}) - ${f.displayGroup} - cost ${f.cost}`);
  }

  // 验证
  const { rows } = await client.query(
    'SELECT id, name, enabled, sort_order FROM features ORDER BY sort_order'
  );
  console.log(`\n📊 共 ${rows.length} 条功能配置`);
  for (const r of rows) {
    console.log(`  ${r.enabled ? '✅' : '❌'} ${r.id} (${r.name}) order=${r.sort_order}`);
  }

  await client.end();
  console.log('\n🎉 features 表 seed 完成');
}

main().catch((err) => {
  console.error('❌ 失败:', err);
  process.exit(1);
});