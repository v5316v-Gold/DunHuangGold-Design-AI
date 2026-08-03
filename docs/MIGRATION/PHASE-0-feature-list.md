# Phase 0 · 17 Feature & Workflow Baseline

**Generated**: 2026-08-03
**Source**: `features` table (DB) + `workflow_templates` table

## 1. Features (17 — all enabled)

| ID | Name | Category | Cost | Exec | Display Group | Order |
|----|------|----------|------|------|----------------|-------|
| text2img | 文案生图 | image | 10 | third-party | 灵感与创作 | 1 |
| refine | 产品精修 | image | 15 | third-party | 灵感与创作 | 2 |
| relief | 图转浮雕图 | 3d | 20 | third-party | 浮雕圆雕 | 3 |
| image3d | 图转3D模型 | 3d | 30 | third-party | 浮雕圆雕 | 4 |
| 2dto3d | **平面转雕塑** | 3d | 25 | third-party | 浮雕圆雕 | 5 |
| blend | 多图融合 | image | 15 | third-party | 灵感与创作 | 6 |
| oneclick | 一键设计 | image | 15 | third-party | 灵感与创作 | 7 |
| multiview | 生成多视图 | image | 20 | third-party | 灵感与创作 | 8 |
| sketch | 线稿/写实 | image | 15 | third-party | 灵感与创作 | 9 |
| free | 自由创作区 | image | 15 | third-party | 灵感与创作 | 10 |
| text2video | 文生视频 | video | 50 | third-party | 生成视频 | 11 |
| img2video | 图生视频 | video | 40 | third-party | 生成视频 | 12 |
| removebg | 移除背景 | image | 5 | third-party | 实用工具 | 13 |
| upscale | 高清放大 | image | 5 | third-party | 实用工具 | 14 |
| watermark | 去除水印 | image | 5 | third-party | 实用工具 | 15 |
| dialogue | AI对话 | chat | 2 | third-party | 灵感与创作 | 16 |
| tryon | 佩戴效果 | image | 25 | third-party | 实用工具 | 17 |

## 2. Workflow Templates (3 — all v1)

| ID | Service | Workflow | ComfyUI Version | Notes |
|----|---------|----------|-----------------|-------|
| text2img-z-turbo | text2img | Z-Turbo 标准文生图 | latest | ✓ imported |
| refine-img2img | refine | img2img 标准精修 | latest | ✓ imported |
| lora-brand-style | text2img | 品牌 LoRA 挂载 | latest | ✓ imported |

## 3. Per-Group Aggregation

| Group | Count | IDs |
|-------|-------|-----|
| 灵感与创作 | 8 | text2img, refine, blend, oneclick, multiview, sketch, free, dialogue |
| 浮雕圆雕 | 3 | relief, image3d, 2dto3d |
| 生成视频 | 2 | text2video, img2video |
| 实用工具 | 4 | removebg, upscale, watermark, tryon |

## 4. Cost Tiers

| Tier | Cost | Features |
|------|------|----------|
| 聊天 | 2 | dialogue |
| 实用工具 | 5 | removebg, upscale, watermark |
| 创作 | 15 | refine, blend, oneclick, sketch, free, text2video-excluded |
| 多视图 | 20 | multiview, 平面转雕塑 |
| 进阶 | 25 | relief, 2dto3d, tryon |
| 高阶 | 30 | image3d |
| 视频 | 40-50 | img2video, text2video |

## 5. Output Type Distribution

| Output Type | Count |
|-------------|-------|
| image | 13 |
| 3d | 3 (relief, image3d, 2dto3d) |
| video | 2 (text2video, img2video) |
| chat | 1 (dialogue) |

## 6. Default Executor Status

**All 17 features use `third-party` as default executor** — meaning the AI gateway
delegates to Minimax/minimax API for content generation, with `comfyui` and `mock`
as backup. No feature currently uses ComfyUI as primary.

## 7. Migration Targets (per 04-L3-AI-Orchestration.md)

All 17 features should be converted from `service.ts` files to `FeatureHandler` shape:

```ts
export interface FeatureHandler<TInput, TOutput> {
  featureSlug: string;
  validate(input: unknown): Promise<TInput>;
  buildExecutionRequest(input, context): Promise<ExecutionRequest>;
  postProcess(result, context): Promise<TOutput>;
}
```

This is **Phase 4** work — not Phase 0.

## 8. ID Stability Guarantee

These 17 IDs are the **single source of truth** for:
- `features.id` (DB)
- `src/config/features.ts` (FEATURE_DEFINITIONS)
- `src/components/layout/Sidebar.tsx` (LABEL_MAP)
- `src/lib/feature-registry.ts` (featureComponents)

Any rename breaks the entire pipeline. **Do not rename without an ADR**.
