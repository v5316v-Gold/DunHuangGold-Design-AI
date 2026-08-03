# 敦煌金 AI 功能清单审计

> 核对范围：前端工作区组件、`src/app/api` 路由、features 配置、算力/API 映射和导航。状态仅基于静态代码核对；未修改源码。

## 总体结论

- **前端导航：17/17 展示**；`Sidebar.tsx` 的 `menuGroups` 包含全部指定 ID。
- **工作区组件映射：17/17 存在并接入**；`WorkspacePanel.tsx` 的 `panelComponents` 包含全部指定 ID。
- **成本配置：17/17 存在于 `src/lib/feature-costs.ts`**；但 `src/config/api-config.ts` 的 `FEATURE_COSTS` 缺少 `tryon`。
- **传统 features 配置：16 项体系，缺少 tryon**；同时使用另一套 kebab-case ID，和 UI/成本 ID 不一致。
- **API 路由：16/17 有专属路由或明确旧路由；tryon 未发现专属路由。** 多数功能也可能通过通用 AI 生成路由，但 tryon 未在 `FEATURE_API_MAP`、`AIServiceType`、服务注册中出现。

## 逐功能核对表

| 功能 ID | 功能名称 | 前端组件 | API 路由 | features 配置 | 状态 | 问题描述 |
|---|---|---|---|---|---|---|
| dialogue | AI 对话 | `AIDialog.tsx`；WorkspacePanel 已映射 | `/api/chat`、`/api/ai-assistant` | `ai-chat`（ID 不同） | ⚠️ | 前端短 ID 与 features kebab/语义 ID 不一致；存在多条对话 API。 |
| text2img | 文案生图 | `Text2Image.tsx` | `/api/generate-image`、通用 `/api/ai/generate` | `text2img` | ✅ | 静态闭环存在；运行时未因 pnpm 缺失验证。 |
| refine | 产品精修 | `ProductRefine.tsx` | `/api/product-refine`、通用生成 | `product-refine`（ID 不同） | ⚠️ | UI/成本使用 `refine`，features 使用 `product-refine`。 |
| blend | 多图融合 | `MultiImage.tsx` | `/api/multi-image`、通用生成 | `multi-image`（ID 不同） | ⚠️ | UI/成本使用 `blend`，features 使用 `multi-image`。 |
| oneclick | 一键设计 | `OneClickDesign.tsx` | `/api/one-click-design`、通用生成 | `one-click-design`（ID 不同） | ⚠️ | UI/成本使用 `oneclick`，features 使用 kebab-case。 |
| multiview | 生成多视图 | `MultiView.tsx` | `/api/multi-view`、通用生成 | `multi-view`（ID 不同） | ⚠️ | UI/成本使用 `multiview`，features 使用 `multi-view`。 |
| sketch | 线稿/写实 | `SketchRealistic.tsx` | `/api/sketch-realistic`、通用生成 | `sketch-realistic`（ID 不同） | ⚠️ | UI/成本使用 `sketch`，features 使用 `sketch-realistic`。 |
| free | 自由创作区 | `FreeCreation.tsx` | `/api/free-creation`、通用生成 | `free-creation`（ID 不同） | ⚠️ | UI/成本使用 `free`，features 使用 `free-creation`。 |
| relief | 图转浮雕图 | `ReliefDesign.tsx` | `/api/relief` | `relief` | ✅ | 专属路由、组件、成本均存在。 |
| image3d | 图转 3D 模型 | `Image3D.tsx` | `/api/image-3d`（文件注释标 deprecated；POST 转发） | `image-3d`（另有 `image3d` 成本/API 映射） | ⚠️ | 存在 `image3d`/`image-3d` 双 ID；专属文件自称废弃，需统一入口。 |
| 2dto3d | 平面转雕塑 | `Dialog2D3D.tsx` | `/api/stereo` | `stereo`（ID 不同） | ⚠️ | UI/成本使用 `2dto3d`，features 使用 `stereo`；API 文件名为 stereo。 |
| removebg | 移除背景 | `RemoveBackground.tsx` | `/api/remove-background` | `remove-background`（ID 不同） | ⚠️ | UI/成本使用 `removebg`，features 使用 `remove-background`。 |
| upscale | 高清放大 | `Upscale.tsx` | `/api/upscale` | `upscale` | ✅ | 组件、专属路由、成本配置存在。 |
| watermark | 去除水印 | `RemoveWatermark.tsx` | `/api/remove-watermark` | `remove-watermark`（ID 不同） | ⚠️ | UI/成本使用 `watermark`，features 使用 `remove-watermark`。 |
| text2video | 文生视频 | `Text2Video.tsx` | `/api/video`（另有视频服务） | `text2video` | ✅ | 组件、视频路由/服务和成本存在；未运行验证。 |
| img2video | 图生视频 | `Image2Video.tsx` | `/api/video`（另有视频服务） | `image2video`（ID 不同） | ⚠️ | UI/成本使用 `img2video`，features 使用 `image2video`。 |
| tryon | 佩戴效果 | `TryOnEffect.tsx`；WorkspacePanel 已映射 | ❌ 未发现 `/api/tryon` 或专属 route.ts | ❌ `features.ts`/`FEATURE_API_MAP` 未发现；仅 `feature-costs.ts` 有成本 | ❌ | 组件调用 `featureId: 'tryon'` 并收集图片/模式/描述，但未发现后端 service 类型、注册、API 映射或 features-status 定义，无法形成可确认的完整闭环。 |

## 一、前端导航核对

`src/components/layout/Sidebar.tsx` 中 `menuGroups` 明确展示：

- 浮雕圆雕：`relief`、`image3d`、`2dto3d`
- 灵感与创作：`dialogue`、`text2img`、`refine`、`blend`、`oneclick`、`multiview`、`sketch`、`free`
- 生成视频：`text2video`、`img2video`
- 实用工具：`removebg`、`upscale`、`watermark`、`tryon`

结论：**导航展示 17/17，全部存在。** 侧边栏还会请求 `/api/admin/features-status`，但状态键是否采用同一套 ID 需要后端返回值进一步验证。

## 二、工作区组件核对

`src/components/workspace/WorkspacePanel.tsx` 已懒加载并映射全部 17 个面板：

`Text2Image`、`AIDialog`、`ReliefDesign`、`Image3D`、`Dialog2D3D`、`ProductRefine`、`MultiImage`、`OneClickDesign`、`MultiView`、`SketchRealistic`、`FreeCreation`、`Text2Video`、`Image2Video`、`RemoveBackground`、`Upscale`、`RemoveWatermark`、`TryOnEffect`。

结论：**组件接入 17/17。** 这只能证明前端面板可被选择/加载，不能证明后端生成闭环。

## 三、features / 成本 / API 映射一致性

### 1. `src/config/features.ts`

该文件注释为“16个AI功能配置”，`FEATURE_DEFINITIONS`/`FEATURE_LIST` 实际包含 16 项：

- 包含：`text2img`、`product-refine`、`multi-image`、`one-click-design`、`multi-view`、`sketch-realistic`、`free-creation`、`remove-background`、`upscale`、`remove-watermark`、`relief`、`image-3d`、`stereo`、`text2video`、`image2video`、`ai-chat`
- **缺失：`tryon`**

### 2. `src/lib/feature-costs.ts`

默认成本包含全部 17 个规范 UI ID，包括 `tryon: 25`。这是目前唯一明确包含完整 17 项成本的主要配置。

### 3. `src/config/api-config.ts`

- `FEATURE_API_MAP` 包含 17 个左右的映射项，但**缺少 `tryon`**。
- `FEATURE_COSTS` **缺少 `tryon`**，同时存在 `image3d` 与 `image-3d` 双键。
- 多项使用短 ID，和 `features.ts` 的 kebab-case 不一致。

### 4. AI service 注册体系

`src/lib/ai-service/types.ts` 的 `AIServiceType` 包含 16 个服务类型（包括 `stereo`、`ai-assistant`），未包含 `tryon`。`src/lib/ai-service/services/index.ts` 导入 17 个服务模块，但没有 `tryon` 服务；因此 tryon 不具备已确认的服务注册闭环。

## 四、API 路由核对

已发现与 17 项相关的专属/候选路由：

- `/api/chat`
- `/api/generate-image`
- `/api/product-refine`
- `/api/multi-image`
- `/api/one-click-design`
- `/api/multi-view`
- `/api/sketch-realistic`
- `/api/free-creation`
- `/api/relief`
- `/api/image-3d`
- `/api/stereo`
- `/api/remove-background`
- `/api/upscale`
- `/api/remove-watermark`
- `/api/video`
- **未发现 `/api/tryon`**

通用 `/api/ai/generate` 与 `/api/ai/generate-async` 位于更深层目录，理论上可承载服务类型路由，但静态核对未发现 tryon 被声明为 `AIServiceType` 或注册服务，故不能将其视为 tryon 已映射。

## 五、缺失项与优先级

### ❌ 缺失

1. `tryon` 未进入 `src/config/features.ts` 的功能定义/列表。
2. `tryon` 未进入 `src/config/api-config.ts` 的 `FEATURE_API_MAP`。
3. `tryon` 未进入 `src/config/api-config.ts` 的 `FEATURE_COSTS`。
4. `tryon` 未进入 `AIServiceType`，未在服务注册入口导入，未发现专属 API route。

### ⚠️ 部分缺失/不一致

1. 其余多数功能前端短 ID 与 features 配置的 kebab-case ID 不一致。
2. `image3d` 与 `image-3d` 并存；`/api/image-3d` 文件标记为 deprecated，存在迁移风险。
3. `dialogue` 的前端组件、`ai-chat` 的配置项和 `/api/chat`/`/api/ai-assistant` 的路由命名不完全统一。
4. `img2video` 与 `image2video` 双命名。

## 六、建议的验收条件

- 建立单一 `FeatureId` 类型并让导航、面板、成本、features-status、API 映射和 service registry 全部复用。
- 为 `tryon` 增加明确的后端入口和 service 实现，或在文档中明确其仅为前端原型；在完成前不能标记为 ✅。
- 增加自动化一致性测试：规范 ID 必须同时存在于导航、组件映射、成本、API 映射、服务注册（对无需专属 route 的功能标记通用入口）。
