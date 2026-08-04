# 敦煌金 AI 设计平台（DunHuangGold-Design-AI）

> 基于 AI 的多功能创意设计平台：文生图 / 3D 建模 / 视频生成 / 图像编辑 / AI 对话，17 大 AI 功能一站式工作台。

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | Next.js 15.1.0 (App Router) · React 19 · shadcn/ui (New York) · Tailwind CSS v4 |
| 后端 | Next.js API Routes（92 路由）· Drizzle ORM · PostgreSQL |
| 队列 | BullMQ + Redis（异步任务） |
| AI | ComfyUI（本地）· MiniMax / Qwen / Zhipu / Meshy（云端）· Mock（开发降级） |
| 质量 | TypeScript 5 · ESLint 9 (flat config) · Vitest · Playwright |
| 部署 | Docker Compose（web / worker / postgres / redis）· pnpm 9 |

## 功能总览（17 大 AI 功能）

| 分组 | 功能 |
|------|------|
| 浮雕圆雕 | 浮雕图生成 · 3D 模型生成 · 图像转立体 |
| 灵感与创作 | 文案生图 · 产品精修 · 多图融合 · 一键设计 · 生成多视图 · 线稿/写实 · 自由创作区 · AI 对话 |
| 生成视频 | 文生视频 · 图生视频 |
| 实用工具 | 移除背景 · 高清放大 · 去除水印 · 佩戴效果 |

## 架构（5 层）

```
L1 Presentation   Next.js pages / workspace / admin
L2 API Layer      Auth / validation / REST（统一 envelope + requestId）
L3 Orchestration  GenerationService / PolicyOrchestrator / Executor Ports / BullMQ
L4 Data           PostgreSQL / Redis / Repositories / Power Ledger
L5 Runtime        Worker / ComfyUI / Cloud / Docker / Health
```

关键设计决策（ADR 摘要）：

- **统一生成入口**：`src/lib/ai/application/generation-service.ts` 承载 create/query/cancel/retry/settlePower 全生命周期，路由只做 HTTP 解析
- **策略驱动编排**：`routing-policy`（主执行器+兜底链）→ `retry-policy`（指数退避）→ `fallback-policy`（降级链）
- **算力账本**：PowerLedger 三态（reserve → consume/release），重复提交不双扣（幂等键）
- **任务状态机**：7 状态（queued → processing → completed/failed/cancelled/dead_letter），非法流转拒绝
- **统一 envelope**：`{ success, data|error, requestId }` + 16 错误码；91/94 路由已注入 requestId
- **Repository 抽象**：TaskRepository / FeatureRepository / WorkRepository 等，DB 失败自动重连 + 内存降级

## 快速开始（本地开发）

### 前置要求

- Node.js 18+（推荐 20/22）
- pnpm 9（`corepack enable && corepack prepare pnpm@9.0.0 --activate`）
- PostgreSQL / Redis（可选：无 DB/Redis 时自动降级内存态，可纯前端开发）

### 安装与启动

```bash
# 1. 安装依赖
pnpm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，至少设置:
#   JWT_SECRET=<32位以上随机串>  （openssl rand -base64 32）
#   DATABASE_URL=postgresql://user:pass@localhost:5432/dunhuang_design
#   API_KEY_ENCRYPTION_KEY=<64位hex>  （openssl rand -hex 32）

# 3. 启动开发服务器（默认 3000 端口）
pnpm dev
# 或指定端口: NODE_ENV=development ./node_modules/.bin/next dev -p 3000
```

打开 [http://localhost:3000](http://localhost:3000)。

> 默认管理员（memory-db 种子，无 PG 时）：`admin@dunhuang.com` / `admin123`

### 常用脚本

```bash
pnpm build          # 生产构建（next build）
pnpm lint           # ESLint 检查
pnpm test           # Vitest（jsdom 默认配置）
pnpm test:node      # Vitest（node 环境配置，含 AI 服务/队列测试）
pnpm db:generate    # Drizzle schema 生成
pnpm db:migrate     # 执行数据库迁移
bash scripts/build-workers.sh   # 构建独立 Worker 产物（tsup → dist-workers/）
```

## 环境变量

完整清单见 `.env.example`。核心变量：

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 连接串 |
| `JWT_SECRET` | ✅ | JWT 签名密钥（≥32 字符） |
| `API_KEY_ENCRYPTION_KEY` | ✅ | Provider 凭据加密密钥（64 位 hex） |
| `REDIS_URL` | 建议 | BullMQ / 限流 / 缓存（无则内存降级） |
| `MINIMAX_API_KEY` | AI 用 | MiniMax 文生图/视频 |
| `QWEN_API_KEY` | AI 用 | 通义千问 LLM |
| `ZHIPU_API_KEY` | AI 用 | 智谱 AI |
| `MESHY_API_KEY` | AI 用 | Meshy 3D 生成 |
| `NEXT_PUBLIC_APP_URL` | 生产 | 应用公网地址 |

> 部署时环境变量一律通过 docker-compose `environment` 注入，**禁止**在镜像内复制 `.env.local`。

## Docker 部署

```bash
# 1. 准备 .env（供 compose 变量替换）
cp .env.example .env
# 填写生产级密钥（JWT_SECRET / DATABASE_URL / API_KEY_ENCRYPTION_KEY / AI keys）

# 2. 构建并启动（web + worker + postgres + redis）
docker compose up -d --build

# 3. 查看状态
docker compose ps
docker compose logs -f web

# 4. 健康检查
curl http://localhost:5000/api/health
# 期望: {"status":"ok","checks":{"app":"ok","database":"ok","redis":"ok",...}}
```

服务说明：

- `web` — Next.js 应用（Dockerfile，端口 5000）
- `worker` — BullMQ 消费者（Dockerfile.worker，独立部署，消费 `ai-tasks` 队列）
- `postgres` / `redis` — 依赖服务（健康检查 + 数据卷持久化）

```bash
# 停止 / 清理
docker compose down          # 停止
docker compose down -v       # 停止并删除数据卷（慎用）
```

## API 概览

统一响应格式：

```jsonc
// 成功
{ "success": true, "data": {...}, "requestId": "req_xxx" }
// 失败
{ "success": false, "error": { "code": "INSUFFICIENT_POWER", "message": "算力不足" }, "requestId": "req_xxx" }
```

| 端点 | 说明 |
|------|------|
| `POST /api/auth/login` / `register` / `GET /api/auth/me` | 认证 |
| `GET /api/features` / `GET /api/v1/features` | 功能元数据（metadata 驱动） |
| `POST /api/ai/generate` | 同步生成（兼容旧端点） |
| `POST /api/ai/generate-async` | 异步任务提交 → `{ taskId, statusUrl }` |
| `GET /api/tasks/[id]` | 任务状态查询（前端轮询） |
| `GET /api/health` | 健康检查（真实探测 DB / Redis / AI key） |
| `GET /api/admin/queue-stats` | 队列指标（admin） |
| `GET/POST /api/works` | 作品管理 |

前端统一任务轮询：`useTaskPolling` Hook + `TaskProgressViewer` 组件（`src/hooks` / `src/components/workspace/sub-components`）。

## 项目结构

```
src/
├── app/                      # Next.js App Router
│   ├── page.tsx              # 工作台（Sidebar + WorkspacePanel）
│   ├── api/                  # 92 个 API 路由（auth/ai/features/tasks/works/admin/...）
│   ├── admin/                # 管理后台
│   └── login/ gallery/ profile/
├── components/
│   ├── layout/               # Header / Sidebar
│   ├── workspace/            # 17 个 AI 功能组件 + WorkspacePanel
│   └── ui/                   # shadcn/ui 基础组件
├── lib/
│   ├── ai/                   # 新架构（Phase 3-8 目标目录）
│   │   ├── application/      #   GenerationService / PowerLedger / ConfigService / Telemetry
│   │   ├── orchestration/    #   PolicyOrchestrator + routing/retry/fallback policies
│   │   ├── domain/           #   ExecutionPlan
│   │   ├── ports/            #   Executor Port（Hexagonal）
│   │   ├── adapters/         #   旧 executor 适配层
│   │   ├── handlers/         #   17 功能 Handler 形态
│   │   └── registry/         #   服务注册表
│   ├── ai-service/           # 旧 AI 服务层（17 services + registry + pipeline）
│   ├── ai-gateway/           # AI 网关（port / adapters / provider-health / router）
│   ├── orchestrator/         # 旧编排器 + executors
│   ├── queue/                # BullMQ 封装 + 任务状态机 + 内存降级
│   └── api/                  # envelope + middleware（withAuth/withRateLimit/...）
├── db/
│   ├── schema/               # Drizzle 表定义（按域拆分）
│   ├── repositories/         # Repository 抽象 + 自动重连
│   └── health.ts             # DB 健康检查
├── hooks/                    # useAuth / useTaskPolling / useFeatures / usePower
├── storage/database/         # 统一数据库入口（转发 @/db）
├── test/                     # Vitest 测试
└── config/                   # 功能配置（features.ts 等）

workers/                      # BullMQ Worker 进程
scripts/                      # 构建/截图/对账脚本
docs/MIGRATION/               # 架构改造蓝图 + Phase 报告
```

## 测试

```bash
pnpm test          # 默认 jsdom 配置（组件/Hook 测试）
pnpm test:node     # node 配置（AI 服务/队列/策略/Repo/PowerLedger 等）
```

覆盖范围：统一 envelope（15 用例）· GenerationService 生命周期（13）· 编排策略（16）· Repository + 重连（8）· PowerLedger（6）· Handler 化（9）· 限流（16）· AI 服务注册（18）· Hook（5）等，**245+ 用例通过**。

## 架构改造路线（docs/MIGRATION/）

平台按架构蓝图 v2.0 增量演进（strangler pattern），已交付：

- ✅ Phase 0 基线 · Phase 1 运行时 · Phase 2 API 基础
- ✅ Phase 3 GenerationService + middleware 全实现 + 91/94 路由 requestId
- ✅ Phase 4 策略驱动编排 + 17 功能 Handler 化 + registry 收敛
- ✅ Phase 5 Repository 抽象 + 配置中心化 + workflow 版本化 + provider 加密注册表
- ✅ Phase 6 PowerLedger 三态 + 对账脚本
- ✅ Phase 7 metadata 前端驱动 + 统一任务轮询
- ✅ Phase 8 Telemetry + 队列指标
- ⏳ Phase 9 加固（压测/备份/standalone 等上线项）

详见 `docs/MIGRATION/EXECUTION-PLAN.md` 与各 Phase 报告。

## 开发规范

1. **包管理器**：必须使用 pnpm（`only-allow` 已强制）
2. **组件**：优先使用 shadcn/ui 基础组件（`src/components/ui/`）
3. **样式**：Tailwind CSS v4 + CSS 变量主题（品牌色 `#C8A45C`）
4. **路径别名**：`@/` → `src/`
5. **API 响应**：统一 envelope（`ok` / `fail`），带 requestId
6. **数据访问**：走 Repository 层，禁止路由直连 DB/Redis/ComfyUI
7. **AI 调用**：经 GenerationService / PolicyOrchestrator，禁止绕过编排层
8. **安全**：API Key 加密存储（AES-256-GCM），禁止日志打印完整 Key
9. **环境变量**：`.env.local` 不入库；部署用 compose environment 注入

## 参考文档

- [Next.js 15 文档](https://nextjs.org/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Drizzle ORM](https://orm.drizzle.team)
- [BullMQ](https://docs.bullmq.io)
- 架构蓝图：`docs/MIGRATION/` 下 12 份架构文档 + ADR
