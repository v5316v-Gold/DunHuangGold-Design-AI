/**
 * scripts/seed-comfyui-bindings.ts
 *
 * W1·R2·OPT-002 — 给 16 个设计类功能**预先 seed 一行 comfyui_configs**,
 * 这样即使没有真实 workflow JSON,功能也可以"被路由到 ComfyUIExecutor",
 * 然后 policyOrchestrator 走 fallback(Minimax / Mock)。
 *
 * 当前版本仅提供占位 binding(workflowJson=null,dry-run 阶段会被 gate 拦截),
 * 后续 ComfyUI 阶段会上传真实的 16 份 workflow,本脚本又会跑一遍
 * `attachConnection` 标记默认 connection。
 *
 * 用法:
 *   DATABASE_URL=... pnpm tsx scripts/seed-comfyui-bindings.ts
 */
import { db } from '@/db';
import { comfyuiConfigs, comfyuiConnections } from '@/db/schema/_tables';
import { features } from '@/db/schema/features';
import { eq } from 'drizzle-orm';

interface BindingSpec {
  featureId: string;
  description: string;
}

const BINDINGS: BindingSpec[] = [
  { featureId: 'text2img', description: '文案生图（待接入 ComfyUI workflow: 文→图）' },
  { featureId: 'refine', description: '产品精修（已存在 workflow: refine-comfyui）' },
  { featureId: 'blend', description: '多图融合（待接入）' },
  { featureId: 'oneclick', description: '一键设计（已存在 workflow: refine-comfyui 复用）' },
  { featureId: 'multiview', description: '生成多视图（复用 refine-comfyui）' },
  { featureId: 'sketch', description: '线稿/写实（复用 refine-comfyui）' },
  { featureId: 'free', description: '自由创作区（复用 refine-comfyui）' },
  { featureId: 'relief', description: '图转浮雕图（已存在 workflow: relief-comfyui）' },
  { featureId: 'image3d', description: '图转 3D 模型（已存在 workflow: image3d-comfyui）' },
  { featureId: '2dto3d', description: '平面转雕塑（复用 image3d-comfyui）' },
  { featureId: 'text2video', description: '文生视频（待接入 workflow: text2video）' },
  { featureId: 'img2video', description: '图生视频（待接入 workflow: img2video）' },
  { featureId: 'removebg', description: '移除背景（已存在 workflow: removebg-comfyui）' },
  { featureId: 'upscale', description: '高清放大（已存在 workflow: upscale-comfyui）' },
  { featureId: 'watermark', description: '去除水印（复用 upscale-comfyui）' },
  { featureId: 'tryon', description: '佩戴效果（待接入 workflow: tryon）' },
];

async function main() {
  if (!db) {
    console.error('DB 未连接');
    process.exit(1);
  }

  // 1) 找默认 connection
  const [conn] = await db.select().from(comfyuiConnections).where(eq(comfyuiConnections.isDefault, true)).limit(1);
  if (!conn) {
    console.error('默认 ComfyUI connection 不存在，请先执行 seed-comfyui-connection');
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;
  for (const b of BINDINGS) {
    // 2) 校验 feature 存在
    const [f] = await db.select({ id: features.id }).from(features).where(eq(features.id, b.featureId)).limit(1);
    if (!f) {
      console.warn(`[skip] feature 不存在: ${b.featureId}`);
      continue;
    }
    const existing = await db.select({ id: comfyuiConfigs.id }).from(comfyuiConfigs).where(eq(comfyuiConfigs.id, `${b.featureId}-comfyui`)).limit(1);
    if (existing.length > 0) {
      // 已存在:补全 is_default + connectionId
      await db
        .update(comfyuiConfigs)
        .set({ connectionId: conn.id, isDefault: true, updatedAt: new Date() })
        .where(eq(comfyuiConfigs.id, `${b.featureId}-comfyui`));
      updated += 1;
    } else {
      await db.insert(comfyuiConfigs).values({
        id: `${b.featureId}-comfyui`,
        featureId: b.featureId,
        connectionId: conn.id,
        isDefault: true,
        enabled: true,
        description: b.description,
        defaultParams: {},
        nodeMapping: {},
        updatedAt: new Date(),
      });
      inserted += 1;
    }
  }
  console.log(`✔ 插入 ${inserted} 个 bindings · 更新 ${updated} 个 · 共 16 个 design features`);
  console.log('下一步: 由 ComfyUI 阶段用 runGate 上传真实 workflow_json 并 active_version_id。');
}

main().catch((e) => {
  console.error('seed-comfyui-bindings failed:', e);
  process.exit(1);
});
