# 管理后台 ↔ 前端功能映射表

> 生成时间：2026-08-13
> 范围：17 个前端功能 + 所有 admin 后台模块
> 目的：找出后台"管了但前端用不上 / 前端用了但后台没管"的死区

---

## 一、前端 17 个功能 ↔ 后台管理映射

| # | 功能 ID | 功能名 | 分类 | 前端组件 | 后台管理 | 后台路由 | 后台页面 | 完整度 |
|---|---------|--------|------|----------|----------|----------|----------|--------|
| 1 | text2img | 文案生图 | image | Text2Image.tsx | ✅ API 设置→功能配置 | `/api/admin/api-config-db` `/api/settings/cloud` | API 设置→云端API→功能配置 | ✅ 全 |
| 2 | product-refine | 产品精修 | image | ProductRefine.tsx | ✅ 同上 | 同上 | 同上 | ✅ |
| 3 | multi-image | 多图融合 | image | MultiImage.tsx | ✅ 同上 | 同上 | 同上 | ✅ |
| 4 | one-click-design | 一键设计 | image | OneClickDesign.tsx | ✅ 同上 | 同上 | 同上 | ✅ |
| 5 | multi-view | 生成多视图 | image | MultiView.tsx | ✅ 同上 | 同上 | 同上 | ✅ |
| 6 | sketch-realistic | 线稿/写实 | image | SketchRealistic.tsx | ✅ 同上 | 同上 | 同上 | ✅ |
| 7 | free-creation | 自由创作 | image | FreeCreation.tsx | ✅ 同上 | 同上 | 同上 | ✅ |
| 8 | remove-background | 移除背景 | image | RemoveBackground.tsx | ✅ 同上 | 同上 | 同上 | ✅ |
| 9 | upscale | 高清放大 | image | Upscale.tsx | ✅ 同上 | 同上 | 同上 | ✅ |
| 10 | remove-watermark | 去除水印 | image | RemoveWatermark.tsx | ✅ 同上 | 同上 | 同上 | ✅ |
| 11 | relief | 浮雕图生成 | 3d | ReliefDesign.tsx | ✅ API 设置 + ComfyUI | `/api/admin/comfyui/workflows` | API 设置→ComfyUI | ✅ |
| 12 | image-3d | 3D模型生成 | 3d | Image3D.tsx | ✅ 同上 | 同上 | 同上 | ✅ |
| 13 | stereo | 图像转立体 | 3d | Dialog2D3D.tsx | ✅ 同上 | 同上 | 同上 | ✅ |
| 14 | text2video | 文生视频 | video | Text2Video.tsx | ✅ API 设置 + ComfyUI | 同上 | 同上 | ✅ |
| 15 | image2video | 图生视频 | video | Image2Video.tsx | ✅ 同上 | 同上 | 同上 | ✅ |
| 16 | ai-chat | AI 对话 | chat | AIDialog.tsx | ✅ API 设置→大模型API | `/api/admin/llm-providers/fetch-models` | API 设置→云端API→大模型API | ✅ |
| 17 | tryon | 佩戴效果 | image | TryOnEffect.tsx | ✅ 同上 | 同上 | 同上 | ✅ |

**结论**：17 个功能**全部**有后台管理。✅ 覆盖率 100%

---

## 二、后台 6 大模块 ↔ 前端使用映射

| 后台模块 | 路由 | 前端是否使用 | 说明 |
|----------|------|--------------|------|
| **功能管理** | `/admin/features` | ✅ Sidebar + WorkspacePanel | 启用/禁用 17 个功能 |
| **算力配置** | `/api/admin/feature-costs` | ✅ AIDialog 等所有功能 | 每次调用的算力消耗 |
| **API 设置** | `/api/settings/cloud` `/api/admin/api-config-db` | ✅ 所有 AI 功能 | 17 功能的云端/ComfyUI 配置 |
| **ComfyUI 工作流** | `/api/admin/comfyui/workflows` | ✅ 16 个 ComfyUI 功能 | 解析/管理 16 个工作流 |
| **LoRA 管理** | `/api/admin/lora` | ⚠️ 后台有，前端未挂载 UI | 数据可管理但前端未使用 |
| **任务中心** | `/admin/tasks` | ✅ 历史/进度 | 用户可看自己的任务 |
| **用户管理** | `/api/admin/users` | ❌ 管理员专用 | 不直接对应前端功能 |
| **算力管理** | `/api/admin/power` | ✅ 用户前台可见 | 余额/流水 |
| **作品管理** | `/api/admin/works` | ⚠️ 后台审核，前端展示 | 后台可审核，前端展示 |
| **API 限流规则** | `/api/admin/rules` | ❌ 后台配置，前端无感知 | 自动生效 |
| **系统设置** | `/api/admin/system` | ❌ 后台专用 | 健康检查等 |
| **统计** | `/api/admin/stats` | ❌ 后台专用 | 数据看板 |
| **LLM 模型管理** | `/api/settings/cloud`（id=llm-*） | ✅ AIDialog | LLM provider + models |

---

## 三、17 个功能 vs 算力配置现状

| 功能 | 当前算力 | 数据源 | 是否可后台改 |
|------|----------|--------|------------|
| text2img | 10 | `getTaskCost('text2img')` | ✅ feature-costs API |
| product-refine | 10 | 同上 | ✅ |
| multi-image | 10 | 同上 | ✅ |
| one-click-design | 10 | 同上 | ✅ |
| multi-view | 10 | 同上 | ✅ |
| sketch-realistic | 10 | 同上 | ✅ |
| free-creation | 10 | 同上 | ✅ |
| remove-background | 10 | 同上 | ✅ |
| upscale | 10 | 同上 | ✅ |
| remove-watermark | 10 | 同上 | ✅ |
| relief | 25 | 同上 | ✅ |
| image-3d | 50 | 同上 | ✅ |
| stereo | 25 | 同上 | ✅ |
| text2video | 50 | 同上 | ✅ |
| image2video | 50 | 同上 | ✅ |
| ai-chat | 2 | `getTaskCost('dialogue')` | ⚠️ AIDialog 用 `getTaskCost('dialogue')` 写死 |
| tryon | 25 | `getTaskCost('tryon')` | ✅ |

**问题**：`ai-chat` 算力 = 2 是 hardcoded 在 `@/lib/power.ts` 中，**后台改不到**！

---

## 四、发现的问题 / 改进点

### 🔴 P0 - 必须改

#### P0-1: ai-chat 算力 hardcoded
- **位置**：`src/lib/power.ts` 写死 `getTaskCost('dialogue') = 2`
- **影响**：后台"算力配置"改了 dialogue 算力但前端不生效
- **方案**：从 `feature-costs` 动态读，参考其他 16 个功能的实现
- **工作量**：小（2-3 行改动）

#### P0-2: 「大模型API」在 CloudApiSettings.tsx 里仍是 mock
- **位置**：`src/components/admin/CloudApiSettings.tsx`（之前查看时是 mock demo）
- **影响**：管理员看到的"AI 写作助手"卡片是 mock，配置不能保存
- **方案**：用现有 `ApiSettingsView.tsx` 替代 `CloudApiSettings.tsx`
- **工作量**：小（1 个组件替换）

#### P0-3: 「功能管理」页面无算力编辑入口
- **位置**：`/admin/features` 页面
- **影响**：管理员只能开关功能，看不到/改不了单个算力
- **方案**：在功能管理页面加"算力"列 + 编辑按钮
- **工作量**：中（~80 行）

#### P0-4: LoRA 管理后端有 UI 但前端 ComfyUI 工作流没接
- **位置**：`/admin/lora` 后台可管理 LoRA
- **影响**：上传的 LoRA 不会被 ComfyUI 工作流实际使用
- **方案**：在 ComfyUI 工作流配置页面加"绑定 LoRA"下拉
- **工作量**：大（~200 行，需改 comfyui-executor）

### 🟡 P1 - 应该改

#### P1-1: 算力消耗未与 features 表关联
- **位置**：`getTaskCost()` 内部硬编码每个功能的算力
- **方案**：从 `feature_costs` 表动态读，fallback 到默认值
- **工作量**：中（~30 行）

#### P1-2: Sidebar `getDisplayGroup` 不与 features.ts 联动
- **位置**：`Sidebar.tsx` 写死 4 个分组
- **影响**：新增功能时需要改两个地方
- **方案**：从 `FEATURE_DEFINITIONS` 读 category 字段，自动渲染
- **工作量**：小（~30 行）

#### P1-3: 「自动获取模型」目前只支持 minimax/deepseek
- **位置**：`provider-models-fetcher.ts`
- **影响**：anthropic/qwen/openai/zhipu 仍需手工录入
- **方案**：后续按需实施（v2）
- **工作量**：每 provider ~20 行

#### P1-4: 「系统设置」页面功能不完整
- **位置**：`/admin/system`
- **影响**：健康检查、缓存、密钥轮换等功能未完全暴露
- **方案**：补全 UI
- **工作量**：中

### 🟢 P2 - 优化项

#### P2-1: 后台无"用户行为分析"
- 缺失：用户最常用功能 / 算力消耗趋势
- 方案：复用 `stats` API 做 dashboard
- 工作量：大

#### P2-2: 无统一"操作审计日志"
- 缺失：谁在何时改了什么
- 方案：所有 admin API 加 audit log
- 工作量：大

#### P2-3: 无"功能灰度发布"
- 缺失：按用户分批开启新功能
- 方案：在 features 表加 `enabled_user_ids jsonb` 字段
- 工作量：中

#### P2-4: 后台导航菜单不直观
- **位置**：admin 页面无统一侧边栏（layout.tsx 是空的）
- **影响**：管理员要靠 URL 跳转
- **方案**：在 admin/layout.tsx 加侧边栏
- **工作量**：中（~100 行）

---

## 五、最值得立即实施的 Top 5

| 优先级 | 改进点 | 影响 | 工作量 |
|--------|--------|------|--------|
| 🥇 | **P0-1: ai-chat 算力动态化** | 高（用户感知）| 0.5h |
| 🥈 | **P0-2: CloudApiSettings.tsx 用 ApiSettingsView** | 中（消除 mock）| 1h |
| 🥉 | **P1-2: Sidebar 分组动态化** | 中（可维护性）| 0.5h |
| 4 | **P0-3: 功能管理加算力编辑** | 中 | 1.5h |
| 5 | **P2-4: admin 侧边栏** | 低（可发现性）| 1.5h |

---

## 六、关键结论

1. **17 个功能覆盖率 100%**（每个功能都有对应的后台管理入口）
2. **最大的死区是 ai-chat 算力 hardcoded** —— 用户和管理员都不一致
3. **后台有 6 个模块**（功能/API/任务/用户/算力/作品），但**没有统一侧边栏导航**
4. **大模型管理 + 联网获取是新增能力**，但覆盖不全（仅 2/6 provider）
5. **LoRA 库数据有但用不到** —— 后台上传了 ComfyUI 不读

