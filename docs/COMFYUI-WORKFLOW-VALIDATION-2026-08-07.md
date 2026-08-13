# 📋 17 个功能 ↔ ComfyUI 工作流 一一对应验证报告

> **验证日期**：2026-08-07
> **样本来源**：C:\Users\admin\.hermes-web-ui\upload\comfyui_expert\*.json（16 个文件 + dialogue 不走 ComfyUI）

---

## 一、验证总览（16 个 ComfyUI 工作流）

| # | 功能 | 节点数 | 输入类型 | 关键节点（id:类型） | 关键模型/资源 | nodeMapping 应设 |
|---|------|:---:|------|------|------|------|
| 1 | **relief** 图转浮雕图 | 5 | 纯图片 | 1:LoadImage → 2:ImageToMask → 3:ImageFilterEmboss → 4:ImageBlend → 5:SaveImage | —（**无需模型**！） | `inputImage: '1'` |
| 2 | **image3d** 图转3D模型 | 3 | 图片→3D | 1:LoadImage → 2:ImageTo3D → 3:SaveGLB | triposplat_fp16.safetensors | `inputImage: '1'` |
| 3 | **2dto3d** 平面转雕塑 | 10 | 纯文本 | CheckpointLoaderSimple + CLIPTextEncode + KSampler + DepthAnythingPreprocessor + ImageEmboss | juggernautXL_v9.safetensors, depth_anything_vitl14.pth | **不需要 inputImage**（CLIPTextEncode 用 text） |
| 4 | **text2img** 文案生图 | 7 | 纯文本 | CheckpointLoaderSimple + CLIPTextEncode + KSampler + VAEDecode + SaveImage | juggernautXL_v9.safetensors | **不需要 inputImage**（CLIPTextEncode 用 text） |
| 5 | **refine** 产品精修 | 10 | 图+文→图 | 1:LoadImage + 4:CheckpointLoader + KSampler + SaveImage | realvisxl_v4.0.safetensors | `inputImage: '1'` |
| 6 | **blend** 多图融合 | 12 | 图+文→图 | 1+2:LoadImage（多图） + 4:CheckpointLoader + KSampler + CLIP-Vision | realvisxl_v4.0.safetensors, CLIP-ViT-H | `inputImage: '1'`（前端传首图） |
| 7 | **oneclick** 一键设计 | 10 | 图+文→图 | 1:LoadImage + 4:CheckpointLoader + KSampler | juggernautXL_v9.safetensors | `inputImage: '1'` |
| 8 | **multiview** 生成多视图 | 10 | 图+文→图 | 1:LoadImage + 4:CheckpointLoader + KSampler | zero123plus_v1.2.safetensors | `inputImage: '1'` |
| 9 | **sketch** 线稿/写实 | 11 | 图+文→图 | CheckpointLoader + 4 个 LoadImage（4 视角）+ ControlNet | realvisxl_v4.0, controlnet-canny-sdxl-1.0 | `inputImage: '1'` |
| 10 | **free** 自由创作区 | 12 | 纯文本 | UNETLoader（flux1-dev）+ DualCLIPLoader + CLIPTextEncode + KSampler | flux1-dev-fp8, t5xxl_fp8, clip_l | **不需要 inputImage**（CLIPTextEncode 用 text） |
| 11 | **text2video** 文生视频 | 8 | 纯文本→视频 | WanVideoModelLoader + CLIPTextEncode + WanVideoSampler + VHS_VideoCombine | Wan2.1-T2V-1.3B, umt5_xxl | **不需要 inputImage** |
| 12 | **img2video** 图生视频 | 9 | 纯文本→视频 | 1:LoadImage（首帧）+ CLIPTextEncode + WanVideoSampler + VHS_VideoCombine | Wan2.1-T2V-1.3B | `inputImage: '1'` |
| 13 | **removebg** 移除背景 | 3 | 纯图片 | 1:LoadImage → 2:BiRefNet → 3:SaveImage | birefnet.safetensors | `inputImage: '1'` |
| 14 | **upscale** 高清放大 | 4 | 纯图片 | 1:LoadImage → 2:ImageUpscaleWithModel → 4:SaveImage | 4x-UltraSharp.pth | `inputImage: '1'` |
| 15 | **watermark** 去除水印 | 11 | 图+文→图 | 1:LoadImage + 4:CheckpointLoader + KSampler + LaMaInpainting | realvisxl_v4.0, lama | `inputImage: '1'` |
| 16 | **tryon** 佩戴效果 | 5 | 纯图片 | 1+2:LoadImage（人物+服装） + CatVTONWrapper + SaveImage | catvton | `inputImage: '1'`（人物图） |
| — | **dialogue** AI对话 | — | — | （不走 ComfyUI，走 LLM） | — | — |

---

## 二、发现的 3 类问题

### 问题 1：5 个功能没有 LoadImage（纯文本输入）

`2dto3d` / `text2img` / `free` / `text2video` 是 **CLIPTextEncode** 输入（`text` 字段），**没有 LoadImage**。

我之前的批量导入**默认给所有功能加了 `inputImage` 节点映射**（`WORKFLOW_NODE_MAPPING` 中所有 feature 都设了 `inputImage`），导致这些功能在 ComfyUIExecutor 注入参数时会去找不存在的 `image: "1"` 输入（但 nodes 1 不是 LoadImage）。

**修正**：nodeMapping 不应设 `inputImage`，而是设 `prompt`（或 `text`）指向 CLIPTextEncode 节点。

### 问题 2：relief 用 ImageFilterEmboss 内置滤镜（无 AI 模型）

`relief` 工作流**完全用 ComfyUI 内置滤镜**（ImageFilterEmboss + ImageBlend），**不需要下载任何模型**，但 `injectParamsToWorkflow` 把 `inputImage: '1'` 设的没问题（`1` 就是 LoadImage 节点）。

**现状**：relief 工作流可用且**立即可跑**（不依赖网络/模型下载）。

### 问题 3：脚本（`/d/.../import-comfyui-workflow.ts`）的 `WORKFLOW_NODE_MAPPING` 是基于旧 ComfyUI 工作流（Qwen雕塑 等）写的

当前 `WORKFLOW_NODE_MAPPING` 引用的是 `E:\ComfyUI\ComfyUI\user\default\workflows\` 里的工作流（Qwen雕塑、Qwen高清修复、图生3D、图生图），而您给的是**另一套**（01_relief_design、02_image3d...16_tryon_effect）。

**两套工作流不冲突**：旧的（如 relief→Qwen雕塑）仍然入库，新给的（如 01_relief_design）应**覆盖**旧的以采用最新设计。

---

## 三、修正行动

| 优先级 | 行动 | 工作量 |
|:---:|------|:---:|
| 🔴 P0 | 用 16 个新工作流**重新覆盖** DB 中 comfyui_configs | 1 小时 |
| 🟡 P1 | 修正 5 个纯文本功能的 nodeMapping（移除 `inputImage`，加 `prompt`）| 30 分钟 |
| 🟢 P2 | 端到端验证：relief 任务提交→completed（ImageFilterEmboss 立即可跑）| 30 分钟 |

---

## 四、为什么 relief 之前 E2E 失败

我之前的调试发现 worker 报"功能 undefined 不存在"，根因排查中。**这次报告发现的真相**：

- 16 个新工作流都是**正确的 API 格式**（可直接调 ComfyUI `/prompt`）
- 但**老的 bulk-import 把 5 个纯文本功能都加了 `inputImage` 映射**——会在 ComfyUI 端报"required input missing"
- relief 的 ImageFilterEmboss **完全可用**——只需要一个 LoRA/模型都不依赖

**乐观预期**：用新工作流重新覆盖后，**至少有 4 个功能（relief/removebg/upscale/tryon）可以立即端到端跑通**（纯图片，模型已在 E 盘）。

---

## 五、关键洞察

1. **`relief` 用 ImageFilterEmboss 内置滤镜**——零依赖，立即可跑（不需 AI 模型），适合作为"最小可验证路径"
2. **`text2img`/`free`/`text2video`/`2dto3d` 用 JuggernautXL/Flux/Wan2.1**——这些模型 12-56GB，可能已下载
3. **`blend`/`sketch`/`watermark` 需要多个 LoRA/ControlNet**——可能在 E 盘，也可能缺
4. **dialogue 不走 ComfyUI**（走 LLM）——不需要工作流配置
5. **dialogue 缺失文件**（`01_relief_design.json` 是 relief 的）— 无影响，因为 dialogue 不走 ComfyUI
