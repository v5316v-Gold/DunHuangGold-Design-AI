# 敦煌金 AI 项目 · 17 功能 vs feature_id 差异核对报告（任务六）

> **执行时间**：2026-08-03
> **范围**：17 个业务功能在 7 个配置层/注册层的 feature_id 一致性核对

---

## 一、结论速览

| 层 | 数量 | 与 17 功能一致 | 差异 |
|---|---|---|---|
| `src/config/features.ts`（FEATURE_DEFINITIONS） | 17 | ✅ 完全一致 | 使用 kebab-case（映射表完整） |
| `src/config/features.ts`（FEATURE_LIST） | 17 | ✅ 完全一致 | — |
| `src/lib/feature-costs.ts` | 17 | ✅ 完全一致 | 使用短 ID |
| `src/lib/feature-registry.ts`（组件层） | 17 | ✅ 完全一致 | 使用短 ID |
| `src/config/api-config.ts`（featureConfigs） | 17 | ✅ 完全一致 | 使用短 ID |
| `src/config/api-config.ts`（FEATURE_API_MAP） | 18 | ⚠️ 含 `image-3d` + `image3d` 双 ID | 冗余别名 |
| `src/lib/ai-service/types.ts`（AIServiceType） | 16 | ❌ **缺 tryon** | 多 `ai-assistant` |
| 专属 API 路由 | 17/17 | ✅ 全部存在 | — |

**核心发现**：
1. **`AIServiceType` 缺 `tryon`（16/17）** —— 唯一实质性缺口，导致统一入口 `/api/ai/generate` 无法路由 tryon 功能
2. **`FEATURE_API_MAP` / `FEATURE_COSTS` 存在 `image3d` + `image-3d` 双 ID 冗余**（历史遗留）
3. **"14 个"的印象来源**：早期版本功能不全 + 多数短 ID 功能无专属路由（走通用入口），实际当前 17 功能已全部具备专属路由

---

## 二、逐层核对明细

### 2.1 features.ts（kebab-case 定义层）— ✅ 17/17

```text
ai-chat / text2img / product-refine / multi-image / one-click-design /
multi-view / sketch-realistic / free-creation / relief / image-3d / stereo /
remove-background / upscale / remove-watermark / text2video / image2video / tryon
```

映射到短 ID 后与标准清单**一一对应**（17/17）。

### 2.2 feature-costs.ts（算力配置层）— ✅ 17/17

```text
dialogue / text2img / refine / blend / oneclick / multiview / sketch / free /
relief / image3d / 2dto3d / removebg / upscale / watermark /
text2video / img2video / tryon
```

### 2.3 feature-registry.ts（组件层）— ✅ 17/17

```text
text2img / dialogue / relief / image3d / 2dto3d / refine / blend / oneclick /
multiview / sketch / free / text2video / img2video / removebg / upscale /
watermark / tryon
```

### 2.4 api-config.ts featureConfigs — ✅ 17/17

与 feature-costs 完全同集合。

### 2.5 AIServiceType（服务类型层）— ❌ 16/17 缺 tryon

```ts
export type AIServiceType =
  | 'text2img' | 'refine' | 'relief' | 'image3d' | 'stereo'
  | 'removebg' | 'upscale' | 'watermark' | 'sketch' | 'blend'
  | 'oneclick' | 'multiview' | 'free' | 'text2video' | 'img2video'
  | 'dialogue' | 'ai-assistant'      // ← 无 tryon！
```

**影响**：
- `/api/ai/generate` 的 `isValidServiceType()` 会拒绝 `tryon`
- `task-queue.ts` 的 `TaskPayload.serviceType` 无法承载 tryon
- `generation-pipeline` 无法注册 tryon 服务

### 2.6 专属 API 路由 — ✅ 17/17 全部存在

```text
generate-image / relief / image-3d / stereo / remove-background / upscale /
remove-watermark / sketch-realistic / multi-image / one-click-design /
multi-view / free-creation / product-refine / video(x2) / tryon / chat
```

---

## 三、缺失项与说明

| 缺失/差异 | 说明 | 状态 |
|---|---|---|
| **AIServiceType 缺 tryon** | 统一入口无法路由 tryon | ❌ **需修复**（见下） |
| `image3d` + `image-3d` 双 ID | API_MAP/COSTS 冗余，两处都映射到 3D | ⚠️ 建议收敛 |
| `ai-assistant` 在 AIServiceType | 是 AI 助手的独立服务，非 17 功能之一 | ✅ 正常 |

**"14 个 feature_id"的历史解释**：
项目早期（W1-W3 重构前）只有 14 个功能有完整闭环（缺 tryon、2dto3d、oneclick 等），
且短 ID 功能无专属路由。当前代码库已演进为 17 个功能全闭环，
仅 AIServiceType 这一层仍停留在 16 个。

---

## 四、修复动作（本次执行）

### 4.1 补 AIServiceType 的 tryon

```ts
// src/lib/ai-service/types.ts
| 'img2video'   // 图生视频
| 'dialogue'    // AI 对话
| 'tryon'       // 佩戴效果（2026-08-03 补齐）
| 'ai-assistant'
```

### 4.2 registry 标记状态

`feature-registry.ts` 已注册全部 17 个组件（含 tryon），
`isFeatureRegistered()` 作为一致性校验入口，Sidebar/WorkspacePanel 共用。

---

## 五、验证清单

- [x] 7 层 feature_id 集合逐一比对
- [x] 17 功能专属路由全部存在（17/17）
- [x] AIServiceType 缺 tryon 已定位
- [x] 双 ID 冗余（image3d/image-3d）已记录
- [x] 补 tryon 到 AIServiceType（执行）
- [x] ts-check + build 验证（执行）
