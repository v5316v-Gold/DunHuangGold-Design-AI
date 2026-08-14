# 敦煌金 AI 设计平台（DunHuangGold-Design-AI）

> 基于 AI 的多功能创意设计平台：文生图 / 3D 建模 / 视频生成 / 图像编辑 / AI 对话，17 大 AI 功能一站式工作台。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Next.js 15.2.3 (App Router) · React 19.2.3 · shadcn/ui · Tailwind CSS v4 |
| 后端 | Next.js API Routes（96 路由）· Drizzle ORM 0.45 · PostgreSQL 18.4 |
| 队列 | BullMQ 6 + Redis 7（异步任务）|
| AI 网关 | ComfyUI（本地）· MiniMax M3/M2.5（云端）· Mock（开发降级）|
| 安全 | AES-256-GCM 加密 · JWT 校验 · 限流 · 幂等防双扣 |
| 可观测 | Sentry · telemetry 14 字段 · 健康检查 · 容量基线 |
| 质量 | TypeScript 5.9 strict · ESLint 9 (flat) 0 警告 · Vitest · Playwright |
| 部署 | Docker Compose（web/worker/postgres/redis）· pnpm 9 · CI/CD |

## 功能总览（17 大 AI 功能）

| 分组 | 功能 |
|------|------|
| 灵感与创作 | **AI 对话**（置顶）· 文案生图 · 产品精修 · 多图融合 · 一键设计 · 生成多视图 · 线稿/写实 · 自由创作区 |
| 浮雕圆雕 | 浮雕图生成 · 3D 模型生成 · 平面转雕塑 |
| 生成视频 | 文生视频 · 图生视频（MiniMax video-01）|
| 实用工具 | 移除背景 · 高清放大 · 去除水印 · 佩戴效果 |

## 架构（5 层）

```
L1 Presentation   Next.js pages / workspace / admin
L2 API Layer      Auth / validation / REST（统一 envelope + requestId）
L3 Orchestration  GenerationService / PolicyOrchestrator / Executor Ports / BullMQ
L4 Data           PostgreSQL / Redis / Repositories / Power Ledger
L5 Runtime        Worker / ComfyUI / Cloud / Docker / Health
```

**关键设计决策（ADR 摘要）**：

- **统一生成入口**：`src/lib/ai/application/generation-service.ts` 承载 create/query/cancel/retry/settlePower 全生命周期，路由只做 HTTP 解析
- **策略驱动编排**：`routing-policy`（主执行器+兜底链）→ `retry-policy`（指数退避）→ `fallback-policy`（降级链）
- **通用 Provider 框架**：`Executor Port`（mock/comfyui/minimax 三执行器可替换）+ `minimax-feature-adapter`（17 功能 ID 分发）
- **算力账本**：PowerLedger 三态（reserve → consume/release），重复提交不双扣（幂等键）
- **任务状态机**：7 状态（queued → processing → completed/failed/cancelled/dead_letter），非法流转拒绝
- **数据库单真源**：Drizzle schema（`src/db/schema/`）+ 7 个 SQL 迁移（`src/db/migrations/`）

## 快速开始

### 前置要求

- Node.js 20 LTS + pnpm 9
- Docker Desktop（WSL2 / Linux 均可）
- 国内网络环境（Minimax API 可达）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 环境变量

复制 `.env.example` 为 `.env.local`，至少配置：

```bash
# 数据库（Docker Compose 启动后）
DATABASE_URL=postgresql://dunhuang1:dunhuang2026@localhost:5432/dunhuang
REDIS_URL=redis://localhost:6379
JWT_SECRET=<32+ 随机字符>
API_KEY_ENCRYPTION_KEY=<64 位 hex>

# Minimax（国内可达 · 对话/图片/视频全支持）
MINIMAX_API_KEY=sk-cp-xxx
MINIMAX_API_BASE=https://api.minimax.chat/v1
MINIMAX_MODEL=MiniMax-M2.5-highspeed
```

### 3. 启动数据库（Docker Compose）

```bash
docker compose up -d postgres redis
```

### 4. 初始化数据

```bash
# 建表迁移（幂等）
node scripts/migrate.js

# 创建管理员
npx tsx src/db/create-admin.ts

# Seed 17 个功能配置
npx tsx scripts/seed-features.ts
```

### 5. 启动开发 / 生产

```bash
# 开发模式
pnpm dev        # http://localhost:5000

# 生产模式（推荐 · 秒级启动）
pnpm build
NODE_ENV=production pnpm start
```

## 管理员账号

```
admin@dunhuang.com / admin123（算力 99999）
```

## AI Provider 能力矩阵

| 能力 | Minimax API | 代码位置 | 状态 |
|------|------------|---------|------|
| LLM 对话 | `POST /v1/chat/completions` | `src/lib/minimax-call-service.ts` | ✅ 可用 |
| 图片生成 | `POST /v1/image_generation` | 同上 | ✅ 可用 |
| 视频生成 | `POST /v1/video_generation`（异步）| 同上 | ✅ 可用 |
| 视频查询 | `GET /v1/query/video_generation` | 同上 | ✅ 可用 |
| TTS 语音 | `POST /v1/text_to_speech` | 同上 | 🟡 待接入 |
| 音乐生成 | `POST /v1/music_generation` | 同上 | 🟡 待接入 |
| 声音克隆 | `POST /v1/voice_clone` | 同上 | 🟡 待接入 |
| ComfyUI 本地 | 13 个工作流函数 | `src/lib/comfyui-service.ts` | 🟡 容器待部署 |

## 项目结构

```
src/
├── app/
│   ├── api/            96 个 route.ts（admin/auth/ai/works 等）
│   ├── admin/         后台管理（features/lora/models/system/tasks）
│   ├── gallery/       作品展示
│   ├── profile/       个人中心
│   └── login/         登录
├── components/         85 个组件（workspace/admin/ui）
├── lib/
│   ├── ai/            hexagon 架构（application/domain/orchestration/ports/registry）
│   ├── ai-service/    17 个 AI 服务注册
│   ├── minimax-*      Minimax 通用 Provider 框架（Phase 9.20）
│   ├── orchestrator/  PolicyOrchestrator + 3 executor
│   ├── api/           envelope（16 错误码）+ middleware（7 个）
│   ├── comfyui-*      ComfyUI 调用
│   ├── db/            schema + repositories + migrations
│   └── sentry/        Sentry 配置 + PII 脱敏
├── db/                7 个 SQL 迁移 + 8 schema + 11 repositories
├── test/              25 个测试文件（单测 269+）
└── storage/           统一数据库入口
```

## 测试

```bash
# 单测（node 环境）
npm run test:node

# 组件测试（jsdom）
pnpm test

# Minimax 真实 API 测试（需 MINIMAX_API_KEY）
NODE_ENV=development vitest run --config vitest.node.config.ts src/test/minimax.test.ts
```

## 部署

### Docker Compose（4 容器）

```bash
docker compose up -d          # postgres + redis + web + worker
docker compose ps             # 查看健康状态
docker logs -f dunhuang-web   # 查看 web 日志
```

### 镜像构建

```bash
docker build -f Dockerfile -t dunhuang-web:v1.0 .          # web 438MB
docker build -f Dockerfile.worker -t dunhuang-worker:v1.0 . # worker 1.44GB
```

### CI/CD

GitHub Actions（`.github/workflows/ci.yml`）：install → typecheck → test → build

## 性能基线（dev mode）

| 并发 | QPS | P99 |
|------|-----|-----|
| 10 | 106.7 | 139ms |
| 50 | 387.6 | 140ms |
| 100 | 493.8 | 212ms |
| 500 | 630.9 | 313ms |

## 里程碑

- **Phase 0-8** ✅ 100%（架构规范 12 份全部兑现）
- **Phase 9.17** node:20-alpine 基础镜像
- **Phase 9.18** ESLint 402 警告清理 → **0 警告 0 错误**
- **Phase 9.19** AI provider 标识变更（Minimax）
- **Phase 9.20** Minimax 通用 Provider 框架（4 文件 + 测试 6/6）
- **Phase 9.21** Sidebar 排序修复 + 视频功能解锁 + 助手改名

## 文档

- [迁移蓝图](docs/MIGRATION/ARCHITECTURE-BLUEPRINT-V2.md)
- [执行计划](docs/MIGRATION/EXECUTION-PLAN.md)
- [容量基线](docs/MIGRATION/PHASE-9-CAPACITY-BASELINE.md)
- [Sentry 接入](docs/MIGRATION/SENTRY-SETUP.md)
- [部署笔记](docs/MIGRATION/PHASE-9-DEPLOYMENT-NOTES.md)
- [AI Provider 决策](docs/MIGRATION/PHASE-9-AI-PROVIDER-DECISION.md)

## 许可

内部项目（敦煌金 · Dharma Helper 工程中台）
