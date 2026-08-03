# 路由合并方案 — 77 → 35

## 现状分析

### 77 个路由分类

| 类别 | 当前数量 | 合并目标 |
|------|---------|---------|
| 创作类（生成/编辑） | 17 | 4 |
| ComfyUI 管理类 | 9 | 2 |
| Admin 用户/权限类 | 8 | 2 |
| Admin 设置类 | 8 | 3 |
| Admin ComfyUI 配置 | 6 | 2 |
| Auth 类 | 4 | 4 |
| 系统类（upload/download/power） | 7 | 5 |
| Works/Stats 类 | 5 | 3 |
| AI 对话类 | 4 | 2 |
| 其他 | 4 | 2 |
| **合计** | **77** | **~33** |

---

## 具体合并方案

### 阶段一：AI 生成类（影响最大，先做）

**当前：14 个独立路由**
```
generate-image      → 删除，合并到 /api/ai/generate
product-refine     → 删除，合并到 /api/ai/generate  
multi-image        → 删除，合并到 /api/ai/generate
one-click-design   → 删除，合并到 /api/ai/generate
multi-view         → 删除，合并到 /api/ai/generate
sketch-realistic   → 删除，合并到 /api/ai/generate
free-creation      → 删除，合并到 /api/ai/generate
relief             → 删除，合并到 /api/ai/generate
image-3d           → 删除，合并到 /api/ai/generate
stereo             → 删除，合并到 /api/ai/generate
remove-background  → 删除，合并到 /api/ai/generate
upscale            → 删除，合并到 /api/ai/generate
remove-watermark   → 删除，合并到 /api/ai/generate
video              → 删除，合并到 /api/ai/generate
```
**合并为：1 个路由** `/api/ai/generate`

**原理：**
- 所有生成/编辑类 API 本质相同：`auth → 检查算力 → 调用服务 → 保存结果 → 返回`
- 差异仅在 `serviceType`（text2img / refine / relief 等）和对应的工作流配置
- 前端所有组件各自独立，但后端不需要各自独立路由

**新路由设计：**
```typescript
// POST /api/ai/generate
Body: {
  service: 'text2img' | 'refine' | 'relief' | 'image3d' | 
           'removebg' | 'upscale' | 'watermark' | 'sketch' | 
           'blend' | 'oneclick' | 'multiview' | 'free' | 
           'stereo' | 'text2video' | 'img2video'
  prompt?: string
  image?: string          // 可选，输入图片
  images?: string[]       // 多图输入
  params?: Record<string, unknown>  // 各功能特有参数
}
```

**兼容策略：**
- 旧路由保留，标记 `@deprecated`，转发到新路由
- 90 天后删除旧路由
- 前端组件无需改动（已经在各自调自己的路由）

---

### 阶段二：ComfyUI 类

**当前：9 个路由**
```
comfyui/route.ts            → 合并到 comfyui/status GET
comfyui/status/route.ts     → 合并到 comfyui/status GET  
comfyui/progress/route.ts   → 合并到 comfyui/status GET
comfyui/prompt/route.ts    → 合并到 comfyui/execute POST
comfyui/execute/route.ts   → 合并到 comfyui/execute POST
comfyui/call/route.ts       → 合并到 comfyui/execute POST
comfyui-image/route.ts      → 独立保留（用途不同）
test-comfyui/route.ts       → 删除（调试用，已不需要）
```
**合并为：3 个路由**
```
GET  /api/comfyui/status     ← 原来3个路由合并
POST /api/comfyui/execute    ← 原来3个路由合并
GET  /api/comfyui-image      ← 独立（图片查询）
```

**Admin ComfyUI 配置（6 → 2）：**
```
admin/comfyui/connections/[id]  → admin/comfyui/connections (合并 GET/POST/PUT/DELETE)
admin/comfyui/workflows/[id]    → admin/comfyui/workflows (合并 CRUD)
admin/comfyui/workflows/parse   → 删除，并入 admin/comfyui/workflows POST
```

---

### 阶段三：Admin 用户/权限（8 → 2）

**当前：**
```
admin/users/route.ts                        → 合并到 admin/users (CRUD in one file)
admin/users/[id]/route.ts                   → 合并到 admin/users
admin/users/[id]/recharge/route.ts         → 合并到 admin/power
admin/power/route.ts                        → 合并到 admin/power
admin/power/recharge/route.ts               → 合并到 admin/power
admin/power/transactions/route.ts          → 合并到 admin/power
```
**合并为：2 个路由**
```
/api/admin/users    ← GET(list) / POST(create) / DELETE(batch) / PUT(update)
/api/admin/power   ← GET(transactions) / POST(recharge) / POST(deduct)
```

---

### 阶段四：Admin 设置类（8 → 3）

**当前：**
```
admin/api-config/route.ts          → 合并到 admin/settings  
admin/api-config-db/route.ts       → 合并到 admin/settings
admin/ai-assistant-config/route.ts → 合并到 admin/settings
admin/feature-costs/route.ts       → 合并到 admin/settings
admin/app-settings/route.ts        → 合并到 admin/settings
admin/translate-settings/route.ts  → 合并到 admin/settings
admin/rules/route.ts               → 独立
admin/stats/route.ts               → 独立
```
**合并为：3 个路由**
```
/api/admin/settings     ← 5个配置类合并（GET/POST by type）
/api/admin/rules       ← 独立
/api/admin/stats       ← 独立
```

---

### 阶段五：系统类（7 → 5）

**当前：**
```
upload/route.ts        → 独立保留（文件上传逻辑复杂）
download/route.ts      → 独立保留
power/route.ts         → 独立保留
stats/route.ts         → 合并到 stats/all
works/route.ts         → 合并到 works CRUD
works/[id]/route.ts    → 合并到 works CRUD
works/[id]/download    → 合并到 works CRUD
works/batch-delete     → 合并到 works POST
```
**合并为：5 个路由**
```
/api/upload          ← 独立
/download            ← 独立
/power              ← 独立
/api/stats          ← 合并所有统计
/api/works          ← CRUD + batch-delete + download 合并
```

---

### 阶段六：AI 对话类（4 → 2）

**当前：**
```
chat/route.ts                → 独立保留（核心对话）
ai-assistant/route.ts        → 合并到 chat
openclaw-chat/route.ts        → 合并到 chat
prompt-optimize/route.ts     → 独立保留
```
**合并为：2 个路由**
```
/api/chat             ← chat + ai-assistant + openclaw-chat 合并（通过参数区分）
/api/prompt-optimize ← 独立
```

---

## 合并后路由清单（目标：33 个）

```
创作类（1）：
  POST /api/ai/generate           ← 14个旧路由合并

ComfyUI（3）：
  GET  /api/comfyui/status       ← 3个合并
  POST /api/comfyui/execute      ← 3个合并
  GET  /api/comfyui-image        ← 独立

Auth（4）：
  POST /api/auth/register
  POST /api/auth/login
  POST /api/auth/logout
  GET  /api/auth/me

AI 对话（2）：
  POST /api/chat                 ← 3个合并
  POST /api/prompt-optimize       ← 独立

系统类（5）：
  POST /api/upload
  GET  /api/download
  GET  /api/power
  GET  /api/stats
  /api/works                     ← GET/POST/DELETE 合并

Admin 用户（2）：
  /api/admin/users                ← CRUD 合并
  /api/admin/power               ← 充值/交易合并

Admin ComfyUI（2）：
  /api/admin/comfyui/connections ← CRUD 合并
  /api/admin/comfyui/workflows   ← CRUD 合并

Admin 设置（3）：
  /api/admin/settings             ← 5个配置合并
  /api/admin/rules
  /api/admin/stats

系统工具（3）：
  GET  /api/favorites
  POST /api/favorites            ← 合并
  GET  /api/operation-logs
  GET  /api/performance/metrics
  POST /api/performance/metrics  ← 合并
  DELETE /api/performance/metrics

其他（3）：
  POST /api/translate
  GET  /api/translate-settings
  GET  /api/config-status
  POST /api/clear-cache
```

---

## 实施策略

### 策略：渐进式合并（不破坏现有功能）

```
第 1 步：在现有路由中新增服务分发（只加不减）
第 2 步：前端逐步切换到新路由（可选）
第 3 步：旧路由标记 @deprecated
第 4 步：90 天后删除旧路由
```

**新增 AI 生成代理（阶段一）：**
```typescript
// 新增 /api/ai/generate/route.ts
// 现有 14 个路由全部标记 @deprecated 并转发到新路由
// 90 天后删除旧路由文件
```

**这样做的好处：**
- 任何时候出问题可以回退
- 前端可以逐步迁移，不是一次性大改
- 不影响现有用户使用

---

## 预估工作量

| 阶段 | 涉及文件 | 预估工时 |
|------|---------|---------|
| 阶段一 AI 生成代理 | 新增1个 + 标记14个 deprecated | 3-4 小时 |
| 阶段二 ComfyUI | 删除 6 个，合并到 3 个 | 2 小时 |
| 阶段三 Admin 用户 | 删除 5 个，合并到 2 个 | 1.5 小时 |
| 阶段四 Admin 设置 | 删除 5 个，合并到 3 个 | 1.5 小时 |
| 阶段五 系统类 | 删除 3 个，合并到 2 个 | 1 小时 |
| 阶段六 AI 对话 | 删除 2 个，合并到 1 个 | 1 小时 |
| 前后端联调 + 测试 | — | 3-4 小时 |
| **合计** | **删除 35 个文件** | **12-15 小时** |
