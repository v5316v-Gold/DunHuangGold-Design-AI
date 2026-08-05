# 🎯 改进方案 — 敦煌金 AI 设计平台

> **基于**：《敦煌金项目定位与总体架构原则.docx》
> **对照**：`D:\DunHuangGold-Design-AI-main` 现状扫描
> **生成时间**：2026-07-28
> **作者**：全栈架构师 Agent

---

## 📋 一、文档核心要点回顾

文档明确了项目的**五大支柱**：

| 支柱 | 核心要求 |
|------|----------|
| **1. 项目定位** | 面向珠宝设计场景的 **AI 工作台**（非单一出图工具） |
| **2. 架构原则** | **五层架构** + **前后端分离** + **能力下沉** |
| **3. 核心业务流程** | 前端发起 → 后端调度 → AI 执行 → 结果入库 → 前端展示 |
| **4. 模块规划** | 作品展示 + 个人中心 + 管理员后台 |
| **5. 落地策略** | 第一阶段跑通数据流 → 第二阶段公网商用 |

**关键约束**：
- ✅ 隔离第三方服务（前端不直接调 ComfyUI/Tripo3D）
- ✅ 参数与配置隐藏（LoRA/工作流仅管理员可见）
- ✅ 闭环流程（前端 → 后端 → AI → 入库 → 前端）
- ✅ P0 优先：业务后端 + AI Gateway + Redis 队列 + Worker + 对象存储 + 任务状态管理

---

## 📊 二、现状与文档要求的差距分析

我用 5 个维度对照扫描了本项目（`D:\DunHuangGold-Design-AI-main`），结果如下：

### 2.1 L1 用户层/前端 — ⚠️ 部分达标

| 文档要求 | 现状 | 差距 |
|----------|------|------|
| Next.js 15 + App Router + React 19 + TS 5 + Tailwind 4 + shadcn | ✅ 全部一致 | 无 |
| 登录鉴权 + 角色区分 | ✅ `src/app/login/page.tsx` + `useAuth.ts` | 无 |
| **设计工坊交互** | ✅ `src/app/page.tsx` + `WorkspacePanel.tsx` | 无 |
| 任务提交 + 作品预览 | ✅ 17 个 workspace 组件 | 无 |
| **前端不接触底层工作流** | ❌ 仍直接调 `/api/comfyui/*` | **中**（需收敛到 `/api/ai/generate`） |
| **隔离 ComfyUI** | ❌ 有 7 个 `comfyui/*` 路由直接暴露 | **高**（违反"前端不直接调第三方"） |

### 2.2 L2 业务后端层 — ⚠️ 框架在，深度不够

| 文档要求 | 现状 | 差距 |
|----------|------|------|
| 用户管理 + JWT 鉴权 | ✅ `src/lib/auth.ts` | 无 |
| 权限控制 | ⚠️ 15+ 处散写 `role !== 'admin'` | **高**（需抽 `requireAdmin`） |
| **算力/积分管理** | ❌ 致命 #1（无事务/无锁/可双花） | **致命** |
| 任务创建与调度 | ⚠️ `generation-pipeline.ts` 同步阻塞 | **高**（缺 BullMQ） |
| 作品记录 + 历史查询 | ✅ `works` 表 + `/api/...` | 无 |
| **对 AI Gateway 统一调用** | ⚠️ `/api/ai/generate` 存在但老路由仍并行 | **中**（需 90 天淘汰计划） |

### 2.3 L3 AI Gateway 层 — 🔴 最大短板

| 文档要求 | 现状 | 差距 |
|----------|------|------|
| 调度 ComfyUI 工作流 | ⚠️ `comfyui-service.ts` 1500 行单文件 | **高**（需拆 provider） |
| **自动挂载品牌 LoRA** | ❌ 完全缺失（只在 admin 表中） | **致命** |
| 拼接触发词 + 选择模型 | ❌ 写死在 `text2img.ts:18-21` | **高**（需配置化） |
| **对接 Tripo3D** | ⚠️ `meshy-api.ts` 341 行（Meshy 不是 Tripo） | **中**（需澄清 3D 选型） |
| **对接视频生成/佩戴效果** | ❌ 完全缺失 | **致命** |
| **健康检查 + 自动降级** | ⚠️ `checkComfyUIHealth()` 仅在 text2img | **高**（需全局健康检查） |
| **任务队列 (Redis)** | ❌ **完全没接入 BullMQ** | **致命** |

### 2.4 L4 AI 能力执行层 — 🔴 仅 3/14 落地

| 文档要求 | 现状 | 差距 |
|----------|------|------|
| ComfyUI 作为本地核心 | ✅ `comfyui-service.ts` | 无 |
| LoRA 管理 | ❌ 无独立模块 | **致命** |
| 3D（Tripo3D 优先） | ⚠️ Meshy 已有 | **中** |
| **稳定 7 个核心工作流** | ❌ 仅 text2img/refine/relief 真实现 | **致命**（缺 11 个） |
| `removebg / upscale / sketch / blend / multiview / watermark / tryon` | ❌ **全部空壳** | **致命** |

### 2.5 L5 基础设施层 — 🟡 部分达标

| 文档要求 | 现状 | 差距 |
|----------|------|------|
| PostgreSQL | ✅ `drizzle-orm` + `pg` | 无 |
| **Redis（队列+限流）** | ✅ `ioredis` 已装，但**只用于限流** | **高**（需加 BullMQ） |
| **对象存储（Cloudflare R2 / S3）** | ✅ `@aws-sdk/client-s3` 已装 | **低**（需确认是否真用 R2） |
| **Docker + OnePanel** | ✅ `docker-compose.yml` + `deploy/` | 无 |
| **解耦部署**（Web/API/Redis/Postgres/ComfyUI/Worker） | ❌ 当前 compose 只有 `app + nginx` | **高**（缺独立 Worker 容器） |

---

## 🚨 三、关键差距总览（按文档优先级）

| 优先级 | 缺失项 | 文档要求来源 | 风险 |
|:---:|--------|-------------|------|
| **P0** | Redis 任务队列（BullMQ） | 二-5、五-3 | 致命（同步阻塞、任务丢失） |
| **P0** | LoRA 自动挂载机制 | 二-3 | 致命（无品牌一致性） |
| **P0** | 11 个 AI 工作流缺失 | 四-1、五-3 | 致命（14/17 空壳） |
| **P0** | 算力扣减事务化 | 三-1 | 致命（可双花/可透支） |
| **P1** | Tripo3D / 视频 / 佩戴效果 | 二-3 | 高（缺核心能力） |
| **P1** | ComfyUI 健康检查 Worker | 二-3 | 高（单点故障） |
| **P1** | 前端收敛到 `/api/ai/generate` | 一-2 | 中（违反"隔离"原则） |
| **P1** | `requireAdmin` 鉴权抽象 | 二-2 | 中（散写不一致） |
| **P2** | Worker 独立容器 | 五-1 | 中（部署耦合） |
| **P2** | LoRA 管理 UI | 四-3 | 中（仅后台缺失） |

---

## 🎯 四、改进方案（按文档落地策略分层执行）

### 4.1 第一阶段（局域网）— 跑通数据流

> 文档原文："优先跑通完整数据流与任务队列，确保 ComfyUI 稳定、任务不丢、前端不掉线、日志可追踪"

#### 🔴 A. 补齐 AI Gateway（核心任务）

| 任务 | 工作量 | 产出 |
|------|:---:|------|
| **A1. 接入 BullMQ + Redis 队列** | 2 天 | 任务异步化，前端立即返回 jobId |
| **A2. 拆 `comfyui-service.ts` (1500行) → 多 Provider** | 3 天 | `provider/z-image-turbo.ts` / `sd15.ts` / `kling.ts` / `tripo3d.ts` |
| **A3. 落地 LoRA 自动挂载机制** | 2 天 | `lora-resolver.ts` 按 `featureId + style` 选 LoRA + 触发词 |
| **A4. 全局 ComfyUI 健康检查** | 1 天 | `health-worker.ts` 30s 巡检，自动 down 标记 |
| **A5. 算力扣减改事务+行锁+退款** | 2 天 | `power-helper.ts` 重构（应用 `ai-cost-power-metering`） |
| **A6. 落地 7 个核心工作流** | 7 天 | text2img ✓ / refine ✓ / relief ✓ / **新增** removebg / upscale / sketch / blend |
| **A7. 任务状态机 + SSE 推送** | 2 天 | 状态轮询 → SSE 流式 |

**A 段总投入：约 3 周（1 人）**

#### 🟡 B. 收敛前端路由（应用"隔离第三方"原则）

| 任务 | 工作量 | 产出 |
|------|:---:|------|
| **B1. 前端改为只调 `/api/ai/generate`** | 3 天 | 17 个 workspace 组件从直调 comfyui 改为走统一入口 |
| **B2. 旧路由标 `@deprecated` + 90 天计划** | 1 天 | 生成 `/api/comfyui/*` / `/api/remove-background` 等 12+ 旧路由 deprecation 头 |
| **B3. 抽 `requireAdmin` 中间件** | 2 天 | 替换 15+ 处散写 |
| **B4. JWT 移除 localStorage + Refresh Token** | 2 天 | 应用 `jwt-rbac-best-practices` |

**B 段总投入：约 2 周**

#### 🟢 C. 部署解耦

| 任务 | 工作量 | 产出 |
|------|:---:|------|
| **C1. 拆分 Worker 容器** | 2 天 | `docker-compose.yml` 增加 `worker` 服务（消费 BullMQ） |
| **C2. Worker 进程独立部署** | 1 天 | `src/workers/` 目录 + `start-worker.ts` 入口 |
| **C3. 容器健康检查统一 `/api/health`** | 1 天 | 修复当前 `wget` healthcheck |

**C 段总投入：约 1 周**

### 4.2 第二阶段（公网商用）— 文档第四节功能完善

#### 🔵 D. 能力扩展（应用 P1/P2 优先级）

| 优先级 | 模块 | 文档要求 | 工作量 |
|:---:|-------|----------|:---:|
| P1 | 视频生成（Kling/可灵） | 二-3、五-1 | 2 周 |
| P1 | 佩戴效果 | 二-3、五-1 | 1 周 |
| P1 | 3D（Tripo3D 替换/补 Meshy） | 二-3、五-1 | 1 周 |
| P2 | 多视图 | 五-3 P2 | 1 周 |
| P2 | Blender 辅助 | 五-3 P2 | 2 周 |
| P2 | 作品审核 | 四-3 | 3 天 |
| P2 | 模型/LoRA/工作流 UI | 四-3 | 1 周 |

#### 🟣 E. 商业化必备

| 任务 | 文档要求来源 | 工作量 |
|------|-------------|:---:|
| **E1. 安全加固**（限流/审计/密码策略） | 五-2 | 1 周 |
| **E2. 计费报表**（对账/防滥用） | 五-2 | 1 周 |
| **E3. 自动备份**（1Panel 计划任务） | 五-2 | 2 天 |
| **E4. 监控告警**（Sentry + Prometheus） | 五-2 | 1 周 |
| **E5. CI/CD 蓝绿部署** | 五-2 | 1 周 |

**D + E 段总投入：约 8 周**

---

## 📅 五、推荐执行顺序（与文档五-3 优先级对齐）

| Sprint | 周 | 重点 | 文档对应 |
|:---:|:---:|------|----------|
| **S1** | 1-2 | A1 BullMQ + A5 算力 + A6 text2img/refine/relief 验证 | 五-3 P0 |
| **S2** | 3-4 | A2 拆 provider + A3 LoRA + A4 健康检查 | 五-3 P0 |
| **S3** | 5-6 | A6 补 4 个工作流（removebg/upscale/sketch/blend）+ A7 SSE | 五-3 P0 + P1 |
| **S4** | 7 | B1-B4 前端收敛 + 鉴权 | 一-2、二-2 |
| **S5** | 8-9 | C1-C3 Worker 容器 + D1 视频生成 | 五-1、五-3 P1 |
| **S6** | 10-11 | D2 佩戴效果 + D3 Tripo3D | 五-3 P1 |
| **S7** | 12-13 | E1-E5 商业化（安全/计费/备份/监控/CI） | 五-2 |
| **S8** | 14+ | D4-D7 P2 扩展（多视图/审核/Blender/UI） | 五-3 P2 |

---

## 🛠 六、立即可落地的 5 个最小改进（本周可完成）

如果您想**本周就看到效果**，这 5 个改动最快：

| # | 改进 | 工作量 | 可见效果 |
|---|------|:---:|----------|
| **1** | A5 算力扣减事务化 | 2 天 | 并发扣减不再透支（致命 bug 修复） |
| **2** | A1 接入 BullMQ（最小可用） | 2 天 | AI 生成不再卡死前端 |
| **3** | B3 抽 `requireAdmin` | 2 天 | 15+ 处 admin 检查统一 |
| **4** | C3 健康检查统一 | 1 天 | 部署探活更准确 |
| **5** | A3 LoRA 解析器骨架 | 1 天 | 后端能按 feature+style 选 LoRA |

**本周总投入：约 1 人周，5 个 P0/P1 改进全部落地**

---

## 📐 七、架构改进前后对比图

### 改进前（现状）

```
┌─────────────────────────────────────────────────┐
│  前端 (17 个 workspace 组件)                     │
│      │                                          │
│      ├──→ /api/ai/generate ──→ GenerationPipeline│
│      │                          (同步阻塞 5min)   │
│      ├──→ /api/comfyui/execute ──→ ComfyUI ❌ 前端直调│
│      ├──→ /api/comfyui/progress ──→ ComfyUI ❌    │
│      └──→ /api/remove-background ❌ 直调         │
│                                                 │
│      ❌ 无队列   ❌ 无事务   ❌ 14/17 空壳        │
└─────────────────────────────────────────────────┘
```

### 改进后（目标）

```
┌─────────────────────────────────────────────────┐
│ L1 前端 (17 个 workspace 组件)                    │
│      │                                          │
│      └──→ /api/ai/generate (唯一入口) ──→ JWT 鉴权│
│                                              │   │
│ L2 业务后端层                                  ▼   │
│      ├─ 算力事务扣减 (db.transaction + 行锁)      │
│      ├─ 入队 → Redis (BullMQ) → jobId 立即返回  │
│      └─ 状态查询 SSE /api/ai/jobs/:id           │
│                                              │   │
│ L3 AI Gateway                               ▼   │
│      ├─ ServiceRegistry (15 个服务)             │
│      ├─ LoRA Resolver (feature+style → 触发词)  │
│      ├─ Provider Chain (ComfyUI → Meshy → Kling)│
│      └─ Health Check Worker (30s 巡检)          │
│                                              │   │
│ L4 AI 执行层                                 ▼   │
│      ├─ ComfyUI (Z-Turbo/SD1.5/LoRA)           │
│      ├─ Tripo3D / Meshy (3D)                   │
│      └─ Kling / 即梦 (视频)                    │
│                                              │   │
│ L5 基础设施                                  ▼   │
│      ├─ PostgreSQL (Drizzle + 事务)            │
│      ├─ Redis (队列 + 限流 + 缓存)              │
│      └─ R2 / S3 (图片/视频/3D 文件)            │
└─────────────────────────────────────────────────┘
```

---

## 🎁 八、附录：改进方案对应的 25 个 Skill

| 改进项 | 推荐 Skill |
|--------|-----------|
| A1 BullMQ | `ai-gateway-multi-provider` Step 4-5 |
| A2 拆 provider | `ai-gateway-multi-provider` Step 1-3 |
| A3 LoRA | `ai-gateway-multi-provider` + `ai-prompt-engineering-zh` |
| A4 健康检查 | `ai-gateway-multi-provider` 决策表 |
| A5 算力 | `ai-cost-power-metering` 全部 |
| A6 落地 7 个工作流 | `ai-gateway-multi-provider` + ComfyUI 工作流治理 |
| A7 SSE | `ai-streaming-sse-patterns` |
| B1-B4 鉴权收敛 | `jwt-rbac-best-practices` + `nextjs-app-router-patterns` |
| C1-C3 部署 | `docker-multistage-best-practices` + `1panel-deployment-guide` |
| D1 视频 | `ai-gateway-multi-provider` Step 2 |
| E1 安全 | `jwt-rbac-best-practices` + `error-tracking-sentry-setup` |
| E2 计费 | `ai-cost-power-metering` Step 5-8 |
| E3 备份 | `1panel-deployment-guide` |
| E4 监控 | `observability-three-pillars` + `error-tracking-sentry-setup` |
| E5 CI/CD | `cicd-github-actions-zero-downtime` |

---

## 💡 九、立即行动建议

我建议**今天就启动 A1 + A5**（两个 P0 致命项），按照"先止血后建设"原则：

1. **A1 BullMQ 接入**（2 天）— 应用 `ai-gateway-multi-provider` Skill
2. **A5 算力事务化**（2 天）— 应用 `ai-cost-power-metering` Skill

完成后再决定下一步。

**您同意这个方案吗？要立即开始 A1+A5 吗？**
