# 敦煌金 AI 平台 · 架构改造蓝图（详细方案）

> **版本**：v2.0 · Architecture Blueprint
> **依据**：12 份架构文档（01-Architecture Overview ~ 12-ADR）+ 基线数据（Phase 0）
> **执行人**：天枢 (DH-AI-FE-01)
> **日期**：2026-08-03
> **约束**：不重写 17 功能 / 92 路由 / 19 表 / 179 测试；增量演进（strangler pattern）

---

## 第一部分 · 架构依据

### 1.1 项目现状（Phase 0 基线实测）

| 维度 | 数据 |
|------|------|
| 源码文件 | 503（TS/TSX 326） |
| 代码行数 | 91,181 |
| API 路由 | 92（GET 75 / POST 62 / PUT 12 / DELETE 9 / PATCH 2） |
| 前端页面 | 10 |
| 数据库表 | 21（设计目标 19 + 迁移扩展 2） |
| 数据库列 | 235 |
| AI 功能 | 17（全部 enabled） |
| 工作流模板 | 3（text2img-z-turbo / refine-img2img / lora-brand-style） |
| 测试 | 189 passed / 7 skipped（e2e 需 live server） |
| 技术栈 | Next.js 15 / React 19 / TS 5 / Drizzle / BullMQ / Redis / PG 18 |
| 部署 | 1Panel 管理 PG/Redis + pnpm dev（开发）；Docker（规划中） |
| Git 基线 | `3f52623`（本地重新 init，含远程全部源码） |

### 1.2 目标架构（5 层）

```text
┌────────────────────────────────────────────────────┐
│ L1 Presentation                                   │
│ Next.js pages / React components / workspace / admin │
├────────────────────────────────────────────────────┤
│ L2 API Layer                                      │
│ Auth / validation / authorization / REST contracts │
├────────────────────────────────────────────────────┤
│ L3 AI Orchestration                               │
│ Generation service / orchestrator / routing / queue │
├────────────────────────────────────────────────────┤
│ L4 Data & Platform                                │
│ PostgreSQL / Redis / repositories / storage / config │
├────────────────────────────────────────────────────┤
│ L5 AI Runtime & Ops                               │
│ Worker / ComfyUI / cloud / Docker / health / backup │
└────────────────────────────────────────────────────┘
```

### 1.3 依赖规则（强制）

| 允许 | 禁止 |
|------|------|
| L1 → L2 | L1 → DB / Redis / ComfyUI |
| L2 → L3 service | L2 → ComfyUI / workflow JSON / BullMQ 业务逻辑 |
| L3 → L4 via ports | L5 → 直接改用户余额 |
| L3 → L5 via executor ports | Executor → 前端专用 response 形状 |
| L5 worker → L3 services | — |

### 1.4 单一真源（Single Source of Truth）

| 概念 | 真源 |
|------|------|
| 公开功能元数据 | DB `features` 表 |
| 默认功能定义 | Seed 文件（仅默认值） |
| 运行时功能状态 | DB |
| 任务生命周期 | 中央任务状态机 |
| 工作流版本 | Workflow registry（immutable） |
| 成本规则 | Cost service + DB 配置 |
| 用户算力余额 | Power ledger |

### 1.5 关键 ADR（15 项已接受）

| ADR | 决策 |
|-----|------|
| 001 | 采用 5 层架构 |
| 002 | Orchestrator 为强制 AI 入口 |
| 003 | Metadata 驱动功能 |
| 004 | 异步默认（BullMQ） |
| 005 | Docker Compose 开发（移 1Panel） |
| 006 | 一容器一进程（弃 PM2 in container） |
| 007 | 服务名网络（postgres/redis，禁 WSL IP） |
| 008 | Power Ledger（账户/流水/预留） |
| 009 | 工作流版本不可变 |
| 010 | Mock executor 仅限非生产 |
| 011 | 中央任务状态机 |
| 012 | 运行时配置在 DB + Redis 缓存 |
| 013 | API 路由薄（只做 transport） |
| 014 | Repository 抽象 |
| 015 | 增量迁移（非重写） |

---

## 第二部分 · 差距分析（14 项偏离）

| # | 偏离 | 严重度 | 修复阶段 |
|---|------|--------|---------|
| 1 | `ai-service/` 与 `ai-gateway/` 双轨并存 | 🔴 | Phase 4 |
| 2 | 无 GenerationService 统一入口 | 🔴 | Phase 3 |
| 3 | 17 函数非 Handler 形态 | 🔴 | Phase 4 |
| 4 | 无统一 API response envelope（92 路由） | 🔴 | Phase 2 已建 / 3 迁移 |
| 5 | 错误码不一致（8 vs 16） | 🔴 | Phase 2 已建 |
| 6 | 无 ExecutionPlan 快照 | 🔴 | Phase 4 |
| 7 | 任务状态机未强制（6 状态） | 🔴 | Phase 4 |
| 8 | 无 Repository 抽象 | 🔴 | Phase 5 |
| 9 | OnePanel 干扰开发 | 🔴 | Phase 1 已建 / 切换待 5 |
| 10 | 无 14 字段 telemetry | 🔴 | Phase 8 |
| 11 | 算力非原子（无 ledger） | 🔴 | Phase 6 |
| 12 | 测试覆盖不全（缺 5 类） | 🟡 | Phase 9 |
| 13 | 无 ADR 文档 | 🟡 | 进行中 |
| 14 | 2 路由绕过 orchestrator | 🔴 | Phase 3 |

---

## 第三部分 · 分阶段实施方案

---

### ✅ Phase 0 · 基线（已完成）

**目标**：建立可回滚的改造起点。

**产出**：
| 文件 | 内容 |
|------|------|
| `PHASE-0-route-inventory.csv` | 92 路由清单（方法/鉴权/违规标记/迁移目标） |
| `PHASE-0-schema-dump.md` | 21 表 / 235 列 / 38 索引 / 143 约束 |
| `PHASE-0-feature-list.md` | 17 功能 / 3 工作流 / 成本分层 |
| `PHASE-0-boundary-violations.md` | 5 层 import 扫描（0 违规） |
| `PHASE-0-BASELINE.md` | 汇总报告 |

**验证**：git commit `3f52623` + 173 测试可复现。

---

### ✅ Phase 1 · 运行时稳定化（已完成）

**目标**：Docker Compose 替代 1Panel，服务名网络，健康检查。

**产出**：
| 文件 | 内容 |
|------|------|
| `docker-compose.yml` | 5 服务（web/worker/postgres/redis/comfyui-可选）+ 健康检查 + named volumes |
| `.env.development` | 服务名 URL（postgres:5432 / redis:6379） |
| `scripts/dev-stack.sh` | 启动/停止/状态/日志/重启 + 1Panel 防冲突 |
| `docs/MIGRATION/PHASE-1/dumps/` | pg-baseline.sql（1182 行）+ redis-baseline.rdb |

**容错实测**：
- PG 重启 → dev server 需手动重启（drizzle pool 不自动重连）→ Phase 5 修复
- Redis 重启 → dev server 不间断（ioredis 自动重连）✅

**验证**：`bash scripts/dev-stack.sh up` 拒绝 1Panel 冲突 + compose config 通过。

---

### ✅ Phase 2 · API 基础（已完成）

**目标**：统一 envelope + 16 错误码 + 7 middleware + 幂等防双扣。

**产出**：
| 文件 | 内容 |
|------|------|
| `src/lib/api/envelope.ts` | 16 错误码 + ApiSuccess/ApiFailure + ok/fail/ApiErrors |
| `src/lib/api/middleware.ts` | withRequestContext/withAuth/withAdmin/withValidation/withRateLimit/withIdempotency/withAudit + dispatch |
| `src/test/api-envelope.test.ts` | 15 单测（envelope + middleware 全链路） |
| `docs/MIGRATION/PHASE-2-API-REPORT.md` | 迁移指南 |

**16 错误码 → HTTP**：AUTH_REQUIRED 401 / PERMISSION_DENIED 403 / INVALID_INPUT 400 / FEATURE_DISABLED 422 / DUPLICATE_REQUEST 409 / RATE_LIMITED 429 / PROVIDER_UNAVAILABLE 503 等。

**幂等防双扣**：`Idempotency-Key` header + SETNX + requestHash；同 key 同 body → 409；同 key 异 body → 400；Redis 失败 → fail-open。

**验证**：15/15 单测通过；全量 189 测试通过。

---

### ⏳ Phase 3 · GenerationService（下一步执行）

**目标**：92 路由收敛到统一生成服务；envelope 全面切换；幂等闭环。

**新增文件**：
```text
src/lib/ai/
├── application/
│   ├── generation-service.ts    # 统一 create/query/cancel/retry
│   ├── task-service.ts          # 任务 CRUD + 状态机调用
│   ├── feature-service.ts       # 功能元数据（DB 驱动）
│   ├── cost-service.ts          # 成本估算 + 预扣协调
│   └── result-service.ts        # 结果处理 + 作品落库
```

**核心接口（generation-service）**：
```ts
export interface GenerationService {
  create(req: {
    userId: string;
    feature: string;
    mode: 'async' | 'sync';
    inputs: Record<string, unknown>;
    idempotencyKey: string;
    requestId: string;
  }): Promise<{ generationId: string; taskId: string; status: 'queued' }>;

  query(taskId: string, userId: string): Promise<TaskView>;
  cancel(taskId: string, userId: string): Promise<void>;
  retry(taskId: string, userId: string): Promise<void>;
}
```

**流程**（per 04-L3 §4）：
```text
create()
├── load feature metadata (DB)
├── validate feature availability
├── validate feature input (Zod schema from metadata)
├── authorize feature access (role)
├── estimate cost (cost-service)
├── reserve power (power ledger - Phase 6 stub)
├── create generation record
├── create task record (state machine: queued)
├── build execution plan
├── enqueue task (BullMQ)
└── return task reference
```

**路由收敛**：
- `POST /api/ai/generate` → `generationService.create({ mode: 'sync' })`
- `POST /api/ai/generate-async` → `generationService.create({ mode: 'async' })`
- `GET /api/tasks/[id]` → `generationService.query()`
- 新增 `POST /api/v1/generations`（canonical，03-L2 §5）

**验证标准**：
- 新端点 + 旧端点行为一致（回归测试）
- 同 Idempotency-Key 重复提交 → 409 且不双扣
- 92 路由全部换新 envelope（带 requestId）
- 无路由直调 ComfyUI（2 个违规路由收敛）

---

### ⏳ Phase 4 · 编排重构

**目标**：Executor Port + ExecutionPlan + 17 handlers + 双轨收敛。

**新增文件**：
```text
src/lib/ai/
├── orchestration/
│   ├── feature-orchestrator.ts    # 执行链调度（重构）
│   ├── execution-plan.ts          # ExecutionPlan 类型 + 持久化
│   ├── routing-policy.ts          # 路由（优先级/least_busy/延迟）
│   ├── retry-policy.ts            # 指数退避 + 最大重试
│   ├── fallback-policy.ts         # 兜底链
│   └── timeout-policy.ts          # 超时控制
├── domain/
│   ├── feature.ts  generation.ts  task.ts
│   ├── provider.ts  workflow.ts  errors.ts
├── ports/
│   ├── executor.port.ts           # Executor 接口
│   ├── feature-repository.port.ts
│   ├── workflow-repository.port.ts
│   ├── storage.port.ts
│   ├── queue.port.ts
│   ├── power-ledger.port.ts
│   └── telemetry.port.ts
├── adapters/
│   ├── executors/                 # comfyui / third-party / mock
│   └── repositories/              # drizzle 实现
├── queue/
│   ├── queues.ts  producer.ts  consumer-contract.ts  task-state-machine.ts
└── registry/
    ├── feature-handler-registry.ts
    ├── executor-registry.ts
    └── provider-health-registry.ts
```

**ExecutionPlan 结构**（持久化到 task）：
```ts
export interface ExecutionPlan {
  taskId: string;
  featureId: string;
  featureVersion: string;
  executorId: string;
  providerId?: string;
  workflowId: string;
  workflowVersion: string;
  modelBindings: Array<{ role: string; modelId: string; version: string }>;
  timeoutMs: number;
  maxAttempts: number;
  estimatedCost: number;
  fallbackChain: string[];
}
```

**任务状态机（7 状态）**：
```text
queued → processing → completed
          │   ↓
          │  failed → retrying → processing
          │   ↓
          │  cancelled（用户主动）
          └→ dead-letter（重试耗尽）
```

**17 handlers 迁移**：
```ts
export interface FeatureHandler<TInput, TOutput> {
  featureSlug: string;
  validate(input: unknown): Promise<TInput>;
  buildExecutionRequest(input, context): Promise<ExecutionRequest>;
  postProcess(result, context): Promise<TOutput>;
}
```
- `services/text2img.ts` → `handlers/text2img.handler.ts`
- 逐个迁移，每个独立 commit（refactor-safely）

**双轨收敛**：`ai-service/` + `ai-gateway/` → `src/lib/ai/`（统一）。

**验证标准**：
- 无 API→ComfyUI 直调（架构边界测试）
- 每任务持久化 ExecutionPlan
- fallback/retry 测试通过
- Mock executor 生产禁用（ADR-010）

---

### ⏳ Phase 5 · 数据层 + 运行时配置

**目标**：schema 分域 + Repository 抽象 + PG 自动重连 + 配置中心化。

**Schema 分域**（05-L4 §3）：
```text
src/db/schema/
├── auth.ts  users.ts  features.ts  generations.ts  tasks.ts
├── works.ts  favorites.ts  power.ts  models.ts  loras.ts
├── workflows.ts  providers.ts  audit.ts  relations.ts
└── index.ts（barrel only）
```
`_tables.ts` 降级为 barrel export。

**Repository 接口**（05-L4 §4）：
```ts
export interface TaskRepository {
  create(input: CreateTask): Promise<Task>;
  findById(taskId: string): Promise<Task | null>;
  transition(taskId, from: TaskStatus[], to: TaskStatus, patch?): Promise<Task>;
}

export interface FeatureRepository {
  findEnabled(): Promise<Feature[]>;
  findBySlug(slug: string): Promise<Feature | null>;
  updateRuntime(slug: string, patch: Partial<Feature>): Promise<Feature>;
}

export interface PowerLedgerRepository {
  reserve(userId, amount): Promise<Reservation>;
  consume(userId, reservationId): Promise<Transaction>;
  release(userId, reservationId): Promise<void>;
}
```

**PG 自动重连**（解决 Phase 1 发现）：
- Repository 层包 `withRetry`（指数退避 3 次）
- `pg.Pool` 加 `statement_timeout` + 连接重建
- Drizzle pool 销毁重建机制

**运行时配置中心化**（ADR-012）：
- mutable 配置（feature 开关/成本/executor 绑定/工作流版本/prompt 模板/重试/超时）→ DB
- Redis 缓存 + 失效通知
- 源文件只留 defaults/seeds

**验证标准**：
- DB 是运行时唯一真源
- PG 重启 → 应用自动重连（无手动干预）
- admin 更新 → 前端即时反映（缓存失效）

---

### ⏳ Phase 6 · 算力账本（Power Ledger）

**目标**：防双扣 + 失败退款 + 可审计。

**新增表**（07-Database §4.12）：
```sql
CREATE TABLE power_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  generation_id uuid,
  amount integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'reserved',  -- reserved | consumed | released
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);
```

**三态流转**（ADR-008）：
```text
reserve（创建任务时预扣）
  → consume（任务成功，转正式流水）
  → release（任务失败/取消，返还）
```

**原子性**：
- `db.transaction()` 包裹：预扣 + 流水写入
- 失败回滚，不产生脏数据

**对账脚本**：`scripts/reconcile-power.ts`（sum(reserved) + sum(consumed) == balance）。

**验证标准**：
- 失败任务释放算力
- 成功任务产生 ledger 条目
- 余额可对账（无偏差）

---

### ⏳ Phase 7 · 前端 metadata 迁移

**目标**：L1 纯净（无 executor/workflow/成本知识）。

**任务**：
1. Sidebar 用 `/api/v1/features`（已部分做，补 `/api/v1` 版本）
2. Dynamic Workspace Form（inputSchema 驱动，17 功能共用）
3. 统一上传器（全功能共用）
4. 统一任务进度查看器（轮询 → 可升 SSE）
5. 删除前端 feature 硬编码

**FeatureMetadata 契约**（02-L1 §5）：
```ts
export interface PublicFeatureMetadata {
  id: string;
  slug: string;
  name: string;
  description?: string;
  categoryId: string;
  icon: string;
  enabled: boolean;
  visible: boolean;
  sortOrder: number;
  requiredRole?: string;
  estimatedPower: number;
  inputSchema: FeatureInputSchema;
  outputType: 'image' | 'video' | 'model' | 'mixed';
}
```

**验证标准**：
- 17 功能全由 metadata 渲染
- enable/disable 即时生效（无代码改动）
- 前端无 executor/workflow/成本知识

---

### ⏳ Phase 8 · 可观测性

**目标**：任务端到端可追踪。

**14 字段 telemetry**（04-L3 §14）：
```text
requestId traceId taskId generationId userId featureId executorId
providerId workflowVersion modelVersions queueWaitMs executionMs
postProcessMs totalMs attempt estimatedCost actualCost failureCode
```

**结构化日志**：Pino（JSON）替换 console.log。

**指标**（06-L5 §11）：
- queue depth / task completion rate / failure rate / queue wait time
- execution time / Redis reconnect count / PG pool saturation
- ComfyUI availability / GPU utilization / storage failures

**admin 健康页**：`/admin/system` 集成新指标。

**验证标准**：
- 任一任务端到端可追踪（requestId 贯通）
- top 失败类别可见
- provider 健康可见

---

### ⏳ Phase 9 · 加固 + 上线

**目标**：生产可用。

| 任务 | 说明 |
|------|------|
| 压测基线 | k6/wrk，QPS / P99 基线 |
| 重连测试 | PG/Redis 重启自动恢复 |
| 取消/超时/死信测试 | 失败路径全覆盖 |
| 备份恢复演练 | restore drill |
| 密钥轮换测试 | AES key rotation |
| next/standalone | 镜像 347MB → ~50MB |
| 安全清单 | TLS / WAF / 私有网络 / secret 不入 compose |

**部署拓扑**（10-Deployment §6）：
```text
Reverse Proxy (TLS / rate limit)
    ↓
Web containers（可扩）
    ↓
PostgreSQL / Redis / Storage（私有网络）
    ↓
Worker pool（可扩）
    ↓
ComfyUI GPU nodes / cloud providers
```

**验证标准**：
- 文档化容量基线
- 已知失败模式全处理
- 回滚流程验证
- 部署 checklist 全绿

---

## 第四部分 · 里程碑与时间线

```
Week 1: Phase 3 GenerationService（~12h）
Week 2: Phase 4 编排重构（~20h）
Week 3: Phase 5 数据层（~16h）
Week 4: Phase 6 算力账本（~6h）
Week 5: Phase 7 前端迁移（~13h）
Week 6: Phase 8 可观测（~10h）
Week 7: Phase 9 加固 + 上线（~14h）
─────────────────────────────
总计: ~91h ≈ 3-4 周
```

## 第五部分 · 风险与防御

| 风险 | 概率 | 防御 |
|------|------|------|
| 92 路由迁移破坏现有功能 | 中 | 每阶段独立 commit + 回归测试；旧 envelope 保留 |
| 17 handlers 重构破坏生成逻辑 | 中 | 逐个迁移，每个一个 commit + 单测 |
| PG 重连机制不稳定 | 中 | withRetry 指数退避 + 连接池重建 + 实测 |
| 算力账本迁移数据不一致 | 高 | 对账脚本 + 预迁移演练 |
| 前端 metadata 渲染性能 | 低 | inputSchema 缓存 + 骨架屏 |
| 压测发现瓶颈 | 中 | 提前定位，缓存/索引/批处理优化 |

## 第六部分 · 停止条件（11-Migration §3）

遇到以下任一情况 → **停止 + 回滚**：
- 现有测试意外回归
- 数据对账失败
- 重复计费
- 任务状态损坏
- 运行时配置多源

## 第七部分 · 验收总表（Global DoD · 01-Architecture §9）

| 验收项 | 状态 |
|--------|------|
| 17 功能全部可用 | ✅ 基线保持 |
| 179+ 测试继续通过 | ✅ 189 通过 |
| 架构边界测试通过 | ✅ 0 违规 |
| 无 API 路由直调 ComfyUI | ⏳ Phase 3-4 |
| 前端无 workflow/executor 知识 | ⏳ Phase 7 |
| 运行时配置无双源 | ⏳ Phase 5 |
| PG/Redis 重启自动恢复 | ⏳ Phase 5/9 |
| 重复提交不双扣 | ✅ Phase 2 / ⏳ Phase 6 |
| 每任务可追踪元数据 | ⏳ Phase 8 |

---

*蓝图由天枢 (DH-AI-FE-01) 维护 · 依据 12 份架构文档 · 持续演进*
