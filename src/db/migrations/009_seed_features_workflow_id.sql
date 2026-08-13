-- Phase 5.2 · 补全 features.workflow_id 字段
-- 之前 features 表 workflow_id 全为空（依赖 TS 配置兜底）
-- 现在 entries 来自 src/config/comfyui-workflows.ts（仅 text2img 等少数有 workflowId）

-- 文本生成：text2img（Z-Image-Turbo 已有 workflowId）
UPDATE features SET workflow_id = '9ae6082b-c7f4-433c-9971-7a8f65a3ea65' WHERE id = 'text2img';

-- 敦煌系列：relief / image3d / 2dto3d（workflowId 暂留空，由老祖在 ComfyUI 验证后填入）
-- 保留为空（默认 fallback 到 TS 配置），不强行占位
UPDATE features SET workflow_id = NULL WHERE id IN ('relief', 'image3d', '2dto3d', 'refine', 'removebg', 'upscale', 'sketch', 'blend', 'watermark', 'tryon');

-- 同步更新 updated_at
UPDATE features SET updated_at = NOW() WHERE workflow_id IS NOT NULL;
