# 敦煌金 AI 设计平台 · 架构权威文档（单一口径）

> **本文档是项目架构的唯一权威口径**（Single Source of Truth）。
> 其他架构类文档（ARCHITECTURE-V2*、NEW-ARCHITECTURE-VS-CURRENT、PROJECT-ARCHITECTURE 等）均为历史阶段产物，仅作背景参考。
> 最后更新：2026-08-13（Phase 4 起点）

---

## 1. 项目定位

敦煌金 AI 设计平台：面向珠宝行业的 AI 创作工作台。
17 个前端功能（文案生图、产品精修、3D 建模、浮雕、视频生成、AI 对话、佩戴效果等），
支持云端 API 与本地 ComfyUI 双执行路径。

## 2. 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Next.js 15.2.3 (App Router) + React 19 + Tailwind CSS v4 + shadcn/ui |
| 后端 | Next.js API Routes（Node runtime）+ Drizzle ORM |
| 数据库 | PostgreSQL 18.4（22 张表）|
| 缓存/队列 | Redis 7 + BullMQ（ioredis）|
| 对象存储 | MinIO（S3 兼容，@aws-sdk/client-s3）|
| AI 执行 | 云端 API（MiniMax/DeepSeek）+ 本地 ComfyUI (Windows E:\ComfyUI) |
| 任务编排 | 自研 Orchestrator + Worker（BullMQ 队列）|
| 监控 | Sentry + 自研健康检查（system-health）|
| 部署 | Docker Compose（web/worker/postgres/redis/minio 5 容器）|

## 3. 目录结构（权威）

```
src/
├── app/                    # Next.js 路由层
│   ├── api/                # 全部 API 路由（98 个）
│   │   ├── ai/             # 统一 AI 生成入口（generate / generate-async）
│   │   ├── admin/          # 管理后台 API（34 个）
│   │   ├── chat/           # AI 对话（7 provider 支持）
│   │   ├── comfyui/        # ComfyUI 直连（call/execute/progress）
│   │   └── ...             # 各功能 API
│   ├── admin/              # 管理后台页面（10 个 tab）
│   ├── login/ gallery/ profile/   # 前台页面
│   └── middleware.ts       # 全局鉴权（JWT 校验 + admin 拦截）
├── components/
│   ├── admin/              # 后台组件（ApiSettingsView/ModelsEditor 等）
│   ├── layout/             # Sidebar（元数据驱动菜单）
│   └── workspace/          # 17 个前端功能组件
├── config/                 # 静态配置（features/api-settings/categories）
├── db/
│   ├── schema/             # Drizzle 表定义（22 表）
│   ├── migrations/         # SQL 迁移（009 个）
│   └── repositories/       # 数据访问层（Feature/Provider/Task/Work/WorkflowVersion）
├── hooks/                  # React hooks（useAuth/usePower/useFeatures 等）
├── lib/
│   ├── ai/                 # ★ Phase 4 编排层（目标架构）
│   │   ├── domain/         #   Execution Plan 域模型
│   │   ├── ports/          #   Executor Port 接口
│   │   ├── handlers/       #   17 个 Feature Handler（迁移中）
│   │   ├── orchestration/  #   Retry/Fallback/Routing Policy + PolicyOrchestrator
│   │   ├── application/    #   Generation Service / Power Ledger / Config Service
│   │   ├── adapters/       #   Executor 适配器注册
│   │   └── registry/       #   服务注册
│   ├── ai-service/         # ⚠️ 老式服务层（17 services，Phase 4 待迁移，标记 deprecated）
│   ├── ai-gateway/         # ⚠️ 旧网关（Phase 4 合并入编排层）
│   ├── orchestrator/       # ⚠️ 老编排（MockExecutor 待删）
│   ├── queue/              # 任务状态机 + 队列（task-state/task-queue）
│   └── ...                 # auth/power/feature-costs/api-response 等
├── storage/                # 存储层（local/s3）
├── test/                   # 测试（vitest）
└── types/                  # 类型定义
```

## 4. 核心架构原则（Phase 4 起强制）

1. **API 层不得直接调用任何 Provider** —— 必须经 Generation Service → Handler 链 → Executor
2. **单一入口**：所有 AI 生成走 `POST /api/ai/generate`（同步）或 `/api/ai/generate-async`（异步）
3. **17 个 Feature = 17 个 Handler**，注册进 handler registry，元数据驱动
4. **重试/降级/路由策略**由 Policy Orchestrator 统一决策，业务代码不重复实现
5. **任务状态机**：所有状态迁移过 `task-state.ts` 的 `canTransition` 校验
6. **配置数据库化**（Phase 5）：运行参数不写死代码，走 Feature Registry / Provider Registry / Workflow Registry
7. **Incremental Refactoring**：不回退旧历史、不跨阶段重构、不重写；老代码标记 deprecated 后逐批迁移

## 5. 请求处理链路（目标状态）

```
前端组件 → /api/ai/generate
                │
                ▼
        Generation Service
                │
                ▼
       Feature Handler (validate → buildRequest → execute → postProcess)
                │
                ▼
        Policy Orchestrator (routing → retry → fallback)
                │
                ▼
       Executor Port (CloudProviderExecutor | ComfyUIExecutor | LocalLLMExecutor)
                │
                ▼
       Provider API / ComfyUI  →  结果回写 works 表 + 算力扣减
```

## 6. 数据模型（22 张表）

| 表 | 用途 |
|----|------|
| users / sessions | 用户与登录态 |
| features | 17 功能元数据（开关/算力/执行器/工作流）|
| api_configs | 云端 API 凭证（含 LLM 连接，availableModels JSONB）|
| system_settings | 全局配置 KV（cloud_connections / feature-costs 等）|
| works | 作品（输入/输出 URL、算力、状态）|
| tasks | 任务（状态机：pending/processing/completed/failed）|
| power_logs / power_transactions | 算力流水 |
| models | ComfyUI 模型文件管理 |
| loras | LoRA 管理 |
| favorites / prompt_rules / translate_settings / audit_logs 等 | 辅助 |

## 7. 17 个功能清单

| # | ID | 名称 | 分类 | 默认执行器 |
|---|----|------|------|-----------|
| 1 | text2img | 文案生图 | image | third-party → comfyui |
| 2 | product-refine | 产品精修 | image | 同上 |
| 3 | multi-image | 多图融合 | image | 同上 |
| 4 | one-click-design | 一键设计 | image | 同上 |
| 5 | multi-view | 生成多视图 | image | 同上 |
| 6 | sketch-realistic | 线稿/写实 | image | 同上 |
| 7 | free-creation | 自由创作 | image | 同上 |
| 8 | remove-background | 移除背景 | image | 同上 |
| 9 | upscale | 高清放大 | image | 同上 |
| 10 | remove-watermark | 去除水印 | image | 同上 |
| 11 | relief | 浮雕图生成 | 3d | comfyui |
| 12 | image-3d | 3D 模型生成 | 3d | comfyui |
| 13 | stereo | 图像转立体 | 3d | comfyui |
| 14 | text2video | 文生视频 | video | third-party |
| 15 | image2video | 图生视频 | video | third-party |
| 16 | ai-chat | AI 对话 | chat | minimax/hermes 等 7 provider |
| 17 | tryon | 佩戴效果 | image | comfyui |

## 8. 安全基线（Phase 4 前置已加固）

| 项 | 状态 |
|----|------|
| JWT_SECRET | ✅ Dockerfile 不再硬编码，构建期随机占位，运行时 compose 注入 |
| API_KEY_ENCRYPTION_KEY | ✅ 同上（全 0 占位 + 运行时注入真实 64 位 hex）|
| .env / .env.local / .env.development | ✅ 均不入 git（.gitignore 已覆盖）|
| .env.example | ✅ 模板入库（占位符，无真实密钥）|
| API Key 存储 | ✅ 存 DB 加密（api_configs），前端不持有 |
| 中间件鉴权 | ✅ /admin、/api/admin 强制 admin 角色，fail-closed |

## 9. 演进路线（Phase 4-8）

| Phase | 内容 | 状态 |
|-------|------|------|
| 1-3 | 基础设施/网关/后端 | ✅ 完成（本 Phase 前置已收尾文档+安全）|
| **4** | **编排层：17 Handler 迁移 + Policy 接线 + 状态机打通 + 删 Mock** | ⏳ **当前** |
| 5 | 数据层：Repository 收口 + 配置数据库化 + 三大 Registry | ⏳ |
| 6 | 平台能力：算力账本/模型中心/LoRA/Workflow/告警审计 | ⏳ |
| 7 | 前端元数据化：Sidebar/Workspace/表单/上传组件 | ⏳ |
| 8 | 展望：多 Agent/MCP/知识库/插件 | 🔭 |

## 10. 开发约定

- 唯一基线：`main`；不回退旧历史
- 每阶段独立分支（如 `phase4-orchestration`），独立验收后合并
- 增量重构：老代码标记 deprecated → 逐批迁移 → 最后统一删除
- 所有 AI 功能改动必须通过 `scripts/test-chat-schema.mjs` 等价测试 + tsc 0 错误
