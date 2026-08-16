# 敦煌金 AI 设计平台(DunHuangGold Design AI)

> **AI 赋能的珠宝/文化创意设计平台** · 本地 ComfyUI + 云侧 Minimax + Hermes Agent 三执行器协作

[![Next.js](https://img.shields.io/badge/Next.js-15.2.3-black)](https://nextjs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org) [![License](https://img.shields.io/badge/license-proprietary-red)]() [![Status](https://img.shields.io/badge/status-production--ready-brightgreen)]()

---

## 🎯 平台定位

敦煌金 AI 设计平台是为珠宝/文化创意行业打造的 **AI 协同设计工作台**:

- **17 个前台功能**(16 个设计类 + 1 个 AI 对话)统一通过 `featureId` 调用,用户无需感知底层模型
- **本地 ComfyUI** 为主执行器(隐私、可控、低成本),**云侧 Minimax** 作为 fallback
- **AI 对话** 走 Hermes Agent CLI(本机),底层可调 MiniMax 等大模型
- **完整资产闭环**:Feature → Workflow → Model Assets → ComfyUI Runtime

---

## 🏗️ 架构(5 层 Hexagonal)

```
┌────────────────────────────────────────────────────────────────┐
│ L1 · Presentation  Next.js 15.2.3 App Router                  │
│   ├─ /api (69 routes, 含 31 个后台管理端点)                    │
│   ├─ /admin (后台 UI:模型中心 + 系统健康 + 工作流配置)         │
│   └─ /workspace (前台 17 功能面板)                             │
├────────────────────────────────────────────────────────────────┤
│ L2 · Application(application/)                                │
│   ├─ GenerationService(幂等防双扣 + 拒绝覆盖底层字段)         │
│   ├─ PowerLedger(算力账本 三态 reserve/consume/release)        │
│   └─ Telemetry(18 字段落库)                                    │
├────────────────────────────────────────────────────────────────┤
│ L3 · Orchestration(ai/orchestration/)                         │
│   ├─ PolicyOrchestrator(路由+重试+降级+ExecutionPlan)         │
│   ├─ RoutingPolicy / RetryPolicy / FallbackPolicy              │
│   └─ ExecutionPlan(冻结:featureId/workflowVersion/models/      │
│       loras/controlnets/executorId/fallbackChain)               │
├────────────────────────────────────────────────────────────────┤
│ L4 · AI Adapters                                                │
│   ├─ ComfyUIExecutor(16 设计类 主执行器)                       │
│   ├─ HermesAgentExecutor(dialogue 主执行器)                    │
│   └─ MinimaxExecutor = CloudExecutor(fallback 5 真支持)        │
├────────────────────────────────────────────────────────────────┤
│ L5 · Infrastructure                                             │
│   ├─ PostgreSQL 18.4-alpine(21+ 表)                            │
│   ├─ Redis 7-alpine(BullMQ + 幂等 + 缓存)                      │
│   └─ ComfyUI 0.18.2(:8188 本机)                                │
└────────────────────────────────────────────────────────────────┘
```

**依赖方向**:L1 → L2 → L3 → L4 → L5(单向,绝无反向)

---

## 🚀 快速开始(5 步)

### 0. 前置依赖

- **Node.js** ≥ 20 LTS
- **pnpm** ≥ 9
- **Docker Desktop**(或 WSL2 + Docker)
- **ComfyUI** 0.18+ 在 `localhost:8188` 运行
- **模型文件**:ComfyUI 标准目录(checkpoints/loras/controlnet/vae)

### 1. 克隆 & 安装

```bash
git clone git@github.com:v5316v-Gold/DunHuangGold-Design-AI.git
cd DunHuangGold-Design-AI
pnpm install
```

### 2. 环境变量

```bash
cp .env.example .env.local
# 编辑 .env.local,填写必填项(见下表)
```

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@localhost:5432/dunhuang` |
| `REDIS_URL` | ✅ | `redis://localhost:6379` |
| `JWT_SECRET` | ✅ | 90+ 字符随机串 |
| `API_KEY_ENCRYPTION_KEY` | ✅ | 64 hex(用于 API Key 加密存储) |
| `MINIMAX_API_KEY` | ✅ | MiniMax 云侧 API Key(Cloud fallback) |
| `MESHY_API_KEY` | ⚠️ | Meshy 3D(已停用,保留作 fallback) |
| `COMFYUI_HOST` | ✅ | `http://localhost:8188` |
| `NODE_ENV` | ✅ | `production`(AI 对话严禁 dev 模式) |

### 3. 启动依赖(Docker Compose)

```bash
# PostgreSQL + Redis + Web + Worker
docker compose up -d postgres redis

# 等待 healthy
docker ps
```

### 4. 数据库初始化

```bash
# 迁移(自动应用 src/db/migrations/*.sql)
DATABASE_URL=... node scripts/migrate.js

# Seed 17 features
DATABASE_URL=... ./node_modules/.bin/tsx scripts/seed-features.ts

# 创建 admin(可选,e2e 已自动创建)
DATABASE_URL=... JWT_SECRET=... API_KEY_ENCRYPTION_KEY=... \
  ./node_modules/.bin/tsx src/db/create-admin.ts
# → admin@dunhuang.com / admin123(默认)
```

### 5. 启动服务

```bash
# 启动 Web + Worker(生产模式)
docker compose up -d web worker

# 或本地开发
NODE_ENV=production ./node_modules/.bin/next start -p 5000 -H 0.0.0.0
./node_modules/.bin/tsx worker/src/index.ts
```

访问 **http://localhost:5000** → admin@dunhuang.com / admin123 登录。

---

## 📦 17 功能(Phase 9.23 收口)

### 16 设计类 → ComfyUIExecutor(主)+ Cloud fallback

| ID | 功能 | cost | 分组 |
|----|------|------|------|
| text2img | 文案生图 | 10 | 灵感与创作 |
| refine | 产品精修 | 15 | 灵感与创作 |
| relief | 图转浮雕图 | 20 | 浮雕圆雕 |
| image3d | 图转 3D 模型 | 30 | 浮雕圆雕 |
| 2dto3d | 平面转雕塑 | 25 | 浮雕圆雕 |
| blend | 多图融合 | 15 | 灵感与创作 |
| oneclick | 一键设计 | 15 | 灵感与创作 |
| multiview | 生成多视图 | 20 | 灵感与创作 |
| sketch | 线稿/写实 | 15 | 灵感与创作 |
| free | 自由创作区 | 15 | 灵感与创作 |
| text2video | 文生视频 | 50 | 生成视频 |
| img2video | 图生视频 | 40 | 生成视频 |
| removebg | 移除背景 | 5 | 实用工具 |
| upscale | 高清放大 | 5 | 实用工具 |
| watermark | 去除水印 | 5 | 实用工具 |
| tryon | 佩戴效果 | 25 | 实用工具 |

### 1 AI 对话 → HermesAgentExecutor(主)+ Cloud fallback

| ID | 功能 | cost | 分组 |
|----|------|------|------|
| dialogue | AI 对话 | 2 | 灵感与创作(置顶) |

---

## 🛡️ 架构红线(必读)

- ✅ 用户请求**只能**包含 `featureId + 业务 params`
- ❌ **禁止** 传 `workflow_id / model / lora / controlnet / provider / executor`
- ✅ 所有执行统一经过 **GenerationService → Orchestrator → ExecutionPlan → Executor Port**
- ❌ 严禁 Controller / API Route 直连 ComfyUI 或外部 API
- ✅ `features.default_executor` 是路由**唯一真源**(DB)
- ✅ Production 严禁 MockExecutor(ADR-010)
- ✅ Workflow 修改 = 新版本(immutable,ADR-009)
- ✅ ComfyUI Workflow 通过 `/admin/api-settings` → 工作流配置 上传

---

## 📂 项目结构(精简后)

```
src/
├─ app/                        # Next.js 路由(69 routes, 含 31 个后台管理端点)
│  ├─ api/                     # RESTful API
│  │  ├─ ai/generate-async/    # 主入口(异步任务)
│  │  ├─ ai/generate/          # 同步入口(兼容)
│  │  ├─ auth/                 # 认证
│  │  ├─ chat/                 # AI 对话(Hermes + MiniMax fallback)
│  │  ├─ features/             # 功能元数据
│  │  ├─ tasks/                # 任务状态
│  │  ├─ admin/model-registry/ # 模型登记(SHA256/状态/ControlNet)
│  │  └─ admin/system/         # 系统健康(★ ComfyUI 状态聚合)
│  ├─ admin/                   # 后台 UI 页面
│  └─ workspace/               # 前台 17 功能面板
├─ lib/
│  ├─ ai/
│  │  ├─ application/          # L2: GenerationService / PowerLedger / Telemetry
│  │  ├─ orchestration/        # L3: PolicyOrchestrator + Routing/Retry/Fallback
│  │  ├─ domain/               # L3: ExecutionPlan
│  │  ├─ ports/                # L4: Executor Port 接口
│  │  └─ adapters/             # L4: Executor Registry
│  ├─ comfyui/                 # ComfyUI 集成(workflow-gate / dependency-analyzer / custom-node-check)
│  ├─ orchestrator/executors/  # L4: ComfyUIExecutor / HermesAgentExecutor / MinimaxExecutor
│  ├─ db/                      # L5: drizzle schema + repositories
│  └─ feature-registry.ts      # feature_code → 组件 静态映射(唯一真源)
├─ components/                 # UI 组件
├─ worker/src/                 # BullMQ Worker
└─ test/                       # 测试(291 单测 + 19 E2E) + e2e/(Playwright 浏览器测试)
```

---

## ✅ Phase 里程碑

| Phase | 内容 | Commit | GATE |
|-------|------|--------|------|
| Phase 0 | 基线 + 21 表 schema | 3f52623 | ✅ |
| Phase 1-8 | 编排 / 数据层 / 算力 / 前端 / 可观测 | (远程 17 commit) | ✅ |
| Phase 9.19 | AI Provider 标识变更 | 445b143 | ✅ |
| Phase 9.20 | **MiniMax 通用 Provider 框架** | c32cd6f | ✅ |
| Phase 9.21 | Sidebar 排序 + 视频解锁 | cf0aeac | ✅ |
| **Phase 9.22** | **Hardening: 10 项加固 + Lint 0 警** | c617ae3 | **✅ PASS** |
| **Phase 9.23** | **Workflow Asset Closure: 8 项发布门禁 + 模型反向引用** | ed9eeb7 | **✅ PASS** |
| **Phase 9.24** | **Dead Code Cleanup: 393→295 文件, -9K 行** | 9ca79ac | **✅ PASS** |
| **Phase 10** | **生产级修复：算力结算闭环 / 自助充值封堵 / 状态机修复 / 后台 31 端点补全 / SSRF 加固 / 前台结果契约** | 本次提交 | **✅ PASS** |

> 详细修复清单见 [`docs/PRODUCTION-FIXES-2026-08-15.md`](docs/PRODUCTION-FIXES-2026-08-15.md)

---

## 🔒 关键约束(架构师必读)

### Executor 收口

```typescript
type ExecutorType = 'comfyui' | 'hermes' | 'third-party' | 'mock';

// capabilities:
// - ComfyUIExecutor:    16 设计类(text2img/refine/relief/.../tryon)
// - HermesAgentExecutor: {dialogue}
// - MinimaxExecutor:    5 真支持(text2img/text2video/img2video/dialogue/ai_assistant)
// - MockExecutor:       17 全集(ADR-010: production 禁)
```

### ExecutionPlan 冻结(ADR-009 + Phase 9.23 §9)

任务创建时冻结,运行中不变(即使管理员切换 Active Workflow):

```typescript
interface ExecutionPlan {
  taskId: string;
  featureId: string;
  executorId: ExecutorType;
  fallbackChain: ExecutorType[];
  workflowId?: string;
  workflowVersion?: number;     // ← immutable
  models: ModelSnapshot[];      // ← frozen
  loras: AssetSnapshot[];       // ← frozen
  controlnets: AssetSnapshot[]; // ← frozen
  // ...
}
```

### 8 项 Workflow 发布门禁

1. JSON valid
2. Required model dependencies resolved
3. Required custom nodes resolved
4. Input mapping valid
5. Output mapping valid
6. ComfyUI validation passed
7. Dry Run passed
8. 至少绑定一个 Feature

任一 fail → workflow **不可 Active**。

---

## 🧪 测试与 CI

```bash
# 单测(node 配置)
NODE_ENV=development ./node_modules/.bin/vitest run --config vitest.node.config.ts

# 全部测试
pnpm test:node

# 覆盖率门禁（核心 AI 层: statements≥55% / branches≥65% / functions≥55% / lines≥55%）
pnpm exec vitest run --config vitest.node.config.ts --coverage

# Playwright E2E（登录 + 17 功能冒烟 + 任务流转；需 web 实例运行于 5000 端口）
pnpm exec playwright install chromium
E2E_BASE_URL=http://127.0.0.1:5000 pnpm exec playwright test

# 类型检查
./node_modules/.bin/tsc --noEmit

# Lint(0 警告 0 错误是 CI 要求)
pnpm lint

# CI: GitHub Actions
#   install → lint → typecheck → test → coverage → migration → e2e → build
#   全部 fail-fast,无 continue-on-error
```

**当前状态**:`tsc --noEmit` 0 错 / `next build` 成功 / **node 套件 291 用例 100% 通过**（23 个测试文件）+ **Playwright E2E 19 用例通过**（17 功能面板冒烟 + 登录会话 + 任务流转）

**覆盖率门禁（P1）**:核心 AI 编排/账本/门禁/队列层（`lib/ai` + `lib/comfyui` + `lib/queue` + executors）:
- statements 58%+ / branches 74%+ / functions 66%+
- 阈值定义于 `vitest.node.config.ts`（低于阈值 CI 直接失败）

---

## 📊 性能基线

| 场景 | 并发 | req/s | P99 | 错误率 |
|------|------|-------|-----|--------|
| dev /health | 500 | 630.9 | 313ms | 0% |
| 生产容器 /health | 10 | 341 | - | 0% |
| 生产容器 /health | 500 | 323 | 611ms | 0% |

---

## 📚 关键文档

| 文档 | 路径 |
|------|------|
| **Phase 9.22 Hardening 报告** | `docs/MIGRATION/PHASE-9-HARDENING-REPORT.md` |
| **Phase 9.23 Workflow Asset Closure** | `docs/COMFYUI-WORKFLOW-ASSET-CLOSURE-REPORT.md` |
| **Phase 9.24 Dead Code Cleanup** | `docs/PHASE-9-24-DEAD-CODE-CLEANUP.md` |
| **架构蓝图 v2.0** | `ARCHITECTURE-BLUEPRINT-V2.md`(12 份规范合集) |
| **执行计划** | `docs/MIGRATION/EXECUTION-PLAN.md` |
| **Phase 0-9 报告** | `docs/MIGRATION/PHASE-*.md` |
| **Sentry 接入** | `docs/MIGRATION/SENTRY-SETUP.md` |
| **容量基线** | `docs/MIGRATION/PHASE-9-CAPACITY-BASELINE.md` |
| **AI Provider 决策** | `docs/MIGRATION/PHASE-9-AI-PROVIDER-DECISION.md` |
| **UI 设计参数** | `docs/UI-DESIGN-PARAMS.md` |
| **部署说明** | `docs/MIGRATION/PHASE-9-DEPLOYMENT-NOTES.md` |

---

## 🔧 运维脚本

```bash
# 数据库迁移
DATABASE_URL=... node scripts/migrate.js

# 备份
./node_modules/.bin/tsx scripts/backup-db.ts

# 清理陈旧任务(默认 dry-run)
./node_modules/.bin/tsx scripts/cleanup-stale-tasks.ts
./node_modules/.bin/tsx scripts/cleanup-stale-tasks.ts --apply --purge

# 算力对账(默认 DRY-RUN)
./node_modules/.bin/tsx scripts/reconcile-power.ts
./node_modules/.bin/tsx scripts/reconcile-power.ts --apply

# 性能压测
./node_modules/.bin/tsx scripts/benchmark-prod.ts

# Docker 健康自动恢复(WSL)
bash scripts/docker-health-check.sh
```

---

## 🚧 上线前必做(运维清单)

- [ ] **上传 ComfyUI Workflow JSON**(16 个) → 触发发布门禁 → Active
- [ ] **登记模型**(model_registry POST):基础模型 / LoRA / ControlNet(含 SHA256)
- [ ] **worker 容器或 host 装 hermes CLI**(AI 对话功能)
- [ ] 修改 admin 默认密码
- [ ] Sentry 启用(`docs/MIGRATION/SENTRY-SETUP.md` 3 步)
- [ ] 验证 17 功能 enabled(`GET /api/features`)

---

## 📝 License

Proprietary · 内部使用

---

**主分支**:`main` · **最新 commit**:Phase 10 生产级修复（算力结算闭环 / 安全加固 / 后台补全）· **tsc 0 错 / build 通过 / 实机验证通过**