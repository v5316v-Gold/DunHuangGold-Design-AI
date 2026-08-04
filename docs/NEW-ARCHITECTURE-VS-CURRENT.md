# 敦煌金 AI 项目 · 新架构规范 vs 现状对比分析

> **文档保存**：[docs/NEW-ARCHITECTURE-VS-CURRENT.md](<F:/Programs/Hermes Studio/home/user/default/project/DunHuangGold-Design-AI/docs/NEW-ARCHITECTURE-VS-CURRENT.md>)
> **分析时间**：2026-08-03
> **输入**：13 份新架构规范（Architecture Blueprint v2.0）
> **范围**：全面对比 + 迁移路径建议

---

## 一、规范核心要求

| 项 | 要求 | 现状 | 差距 |
|---|---|---|---|
| **17 AI 功能** | 全部保留 | ✅ 完整（17/17）| 0 |
| **92 API 路由** | 全部保留（不删除）| ✅ 92 路由 | 0 |
| **19 数据库表** | 保留 | ✅ 19 表 | 0 |
| **179 测试** | 全部通过（回归基线）| ⚠️ 159 通过 / 12 conditional-skip | 需补 8 个测试 |
| **5 层架构** | 严格依赖方向 | ✅ 已有（5 层）| ⚠️ 部分越界（详见下）|

---

## 二、5 层架构目标 vs 现状

### 2.1 依赖方向（强制规则）

**规范要求**：
```
✅ L1 → L2
✅ L2 → L3 application services
✅ L3 → L4 (ports/repositories)
✅ L3 → L5 (executor ports)
✅ L5 worker → L3 application services
❌ L1 → database / Redis / ComfyUI
❌ L2 → ComfyUI / workflow JSON / direct BullMQ
❌ L5 → direct user balance mutation
❌ Executor → frontend response shape
```

**当前状态**（需审计的越界点）：
- ⚠️ **`src/lib/ai-service/storage-helper.ts`**：L2 路径中（被 `src/lib/api-response.ts` 等 L2 引用），L5 风格 — 需迁移到 L4
- ⚠️ **`src/lib/ai-gateway/adapters/*`**：命名在 `lib/ai-gateway/` 而非 `lib/ai/adapters/`
- ⚠️ **`src/lib/orchestrator/*`**：命名不符（应为 `lib/ai/orchestration/*`）
- ⚠️ **`src/lib/queue/*`**：在 `lib/queue/` 而非 `lib/ai/queue/`
- ⚠️ **老路由**：`/api/ai/generate` + `/api/ai/generate-async` 应作为 `/api/v1/generations` 的兼容层

### 2.2 目标目录结构 vs 现状

```
规范目标                              当前项目                       差距
─────────────────────                ────────────────────              ─────
src/app/(public)/                    src/app/page.tsx               ⚠️ route group 改造
src/app/(studio)/                       (login/, gallery/, profile/)  ⚠️
src/app/admin/                          src/app/admin/                 ✅ 已符合
src/app/admin/{features,loras,       src/app/admin/{features,       ⚠️ models 已加，
models,workflows,providers,           lora,models}                   缺 workflows/providers/audit
tasks,users,works,power,
audit,system}/

src/components/{layout,workspace,    src/components/{layout,         ✅ 已有，待细化
admin,profile,ui}/                    workspace,admin,profile,ui}/    （workspace 子目录化）

src/features/                          (缺失)                          ❌ 需新建
├ feature-catalog/
├ generation/
├ task-history/
├ works/
├ favorites/
└ power/

src/lib/                               src/lib/                        ⚠️ 需调整路径
├ api/                                ├ auth.ts, audit-logger.ts,
│  ├ response.ts                       api-response.ts,
│  ├ request-context.ts                rate-limit.ts,
│  └ errors.ts                       ├ health/
├ ai/                                 ├ orchestrator/               ⚠️ 路径需调整
│  ├ application/                    ├ ai-gateway/
│  │  ├ generation-service.ts        ├ ai-service/
│  │  ├ task-service.ts              └ queue/
│  │  ├ feature-service.ts          │
│  │  ├ cost-service.ts              路径应改为 lib/ai/...
│  │  └ result-service.ts            └
├ orchestration/
│  ├ feature-orchestrator.ts
│  ├ execution-plan.ts
│  ├ routing-policy.ts
│  ├ retry-policy.ts
│  ├ fallback-policy.ts
│  └ timeout-policy.ts
├ domain/
├ ports/
├ adapters/
└ queue/
├ repositories/                       (内联在各模块)                  ❌ 需抽离
├ storage/                            ├ storage/                     ✅ 已有
├ observability/                      ├ observability/ (缺失)         ❌ 需新建
└ security/                           ├ auth.ts, security.ts          ⚠️ 需整理

src/db/                                src/db/                         ⚠️ 需拆分
├ schema/                             ├ schema/_tables.ts (单文件)    ❌ 需按 domain 拆
│  ├ auth.ts, users.ts, features.ts,  │   (aggregator)
│  ├ generations.ts, tasks.ts,      └
│  ├ works.ts, favorites.ts,        (1 文件 vs 12 个)
│  ├ power.ts, models.ts, loras.ts,
│  ├ workflows.ts, providers.ts,
│  ├ audit.ts, relations.ts
├ migrations/
├ repositories/                       (缺失)                          ❌ 需抽离
└ index.ts
```

---

## 三、9 大核心原则 vs 现状

| 原则 | 规范要求 | 现状 | 差距 |
|---|---|---|---|
| **6.1 Orchestration First** | API → GenerationService → FeatureOrchestrator → Router → Executor | ⚠️ 部分实现：原 `/api/ai/generate` 直接调 pipeline，未经过统一的 GenerationService | 需新建 `generation-service.ts` |
| **6.2 Metadata Driven** | sidebar/workspace/permissions 由 `features` 表驱动 | ⚠️ `features.ts` 配置驱动 + Sidebar 用 useFeatures，但 `WorkspacePanel` 仍部分硬编码 17 项组件 | 需 WorkspacePanel 完全走 registry |
| **6.3 Async by Default** | 长任务默认异步 | ✅ 已有 BullMQ + SSE | 0 |
| **6.4 Explicit Task Lifecycle** | 任务状态机集中定义 | ⚠️ 状态散布（tasks.status / queue.state / orchestrator 内部）| 需中央化 TaskStateMachine |
| **6.5 Runtime Config** | 配置放数据库+缓存 | ⚠️ 半数在源码（FEATURE_DEFINITIONS）| 需迁移到 features 表 |
| **6.6 Observability** | requestId/taskId/userId/featureId/executorId/providerId/workflowVersion/modelVersion/queueWait/execTime/failureCode 必带 | ⚠️ 部分有 requestId / taskId，缺 executorId/providerId/workflowVersion | 需补 telemetry 字段 |

---

## 四、API 规格目标 vs 现状

### 4.1 目标 API 树（v1 + admin）

```
目标                                     当前（92 路由，混合）
─────────────                            ─────────────
/api/v1/auth/{login,register,           /api/auth/* (4 路由)
/       logout,me}                       ⚠️ 缺 v1 前缀
/api/v1/features                         /api/features, /api/admin/features/* (10+ 路由)
/api/v1/features/:slug                   ❌ 缺
/api/v1/generations                      /api/ai/generate, generate-async
/api/v1/generations/:id                 ⚠️ 散落在 /api/ai/...
/api/v1/generations/:id/{cancel,retry}  ❌ 缺（admin 端有）
/api/v1/tasks                            ❌ 缺（admin 端有）
/api/v1/works, /favorites, /power,
       /uploads, /profile               /api/works/*, /favorites, /power/*

/api/admin/{features,workflows,         /api/admin/* (28 路由)
       providers,models,loras,           ⚠️ 缺 workflows/providers/audit 子路径
       tasks,users,works,power,
       audit,system}                     ✅ system/tasks 已加
```

### 4.2 统一响应包络（必须执行）

```ts
type ApiSuccess<T> = { success: true; data: T; requestId: string };
type ApiFailure = { success: false; error: { code: string; message: string; details?: unknown }; requestId: string };
```

**当前状态**：
- ✅ 已有 `{ success, data, error, meta }` 模式
- ⚠️ 缺 `requestId` 顶层字段（部分有 `_requestId` 在 meta 里）
- ⚠️ 缺标准化 `error.code` 字符串（已在目录 7 列出 16 个标准 code，但实际路由用得不全）

### 4.3 中间件清单（必须实现）

```
withRequestContext   ← 统一注入 requestId/userId
withAuth              ← 已实现 (requireAuth)
withAdmin             ← 已实现 (requireAdmin)
withValidation        ← 部分 (zod 在各路由)
withRateLimit         ← 已实现 (rate-limit.ts)
withIdempotency        ← 缺失（关键！重复提交会双扣费）
withAudit             ← 已实现 (logAudit)
withErrorBoundary     ← 部分 (error.tsx)
```

**缺失/薄弱**：`withRequestContext`（统一包装）、`withIdempotency`（幂等键防双扣费 — **关键风险！**）

---

## 五、19 表设计 vs 现状

| 规范表名 | 当前表名 | 状态 | 备注 |
|---|---|---|---|
| users | users | ✅ | 已有 role 字段 |
| sessions | sessions | ✅ | 已有 |
| features | features | ✅ | 本会话新增 |
| **feature_categories** | ❌ | ❌ 缺失 | 4 个分类（"浮雕圆雕"/"灵感与创作"/"生成视频"/"实用工具"）目前硬编码在 Sidebar |
| **generations** | ❌ | ❌ 缺失 | 替代当前 `tasks` 表 + 新增 generationId 链路 |
| tasks | tasks | ✅ | 本会话扩展 5 字段 |
| works | works | ✅ | 已有 feature_code 字段 |
| favorites | favorites | ✅ | 已有 |
| **assets** | ❌ | ❌ 缺失 | 统一的输入/输出资产元数据表（model upload 现直接落盘）|
| power_accounts | ❌ | ❌ 缺失 | 替代 `users.power`（账户汇总）|
| power_transactions | power_transactions | ✅ | 已有 |
| **power_reservations** | ❌ | ❌ 缺失 | **幂等性关键**，预留算力再执行 |
| models | models | ✅ | 本会话新增 |
| loras | comfyuiConfigs（部分）| ⚠️ 错位 | 需独立 loras 表 |
| **workflows** | workflows | ✅ | 已有（需补 slug 字段）|
| **workflow_versions** | ❌ | ❌ 缺失 | **关键缺失**：不可变工作流版本表 |
| **providers** | ❌ | ❌ 缺失 | Provider 注册表（替代 apiConfigs 概念）|
| **provider_credentials** | ❌ | ❌ 缺失 | 加密的 Provider 凭据（替代 apiConfigs.apiKey）|
| audit_logs | auditLogs | ✅ | 本会话新增 |

**统计**：
- ✅ 已有 9 张（高度符合）
- ⚠️ 部分 2 张
- ❌ 缺失 8 张（feature_categories/generations/assets/power_accounts/power_reservations/workflow_versions/providers/provider_credentials）

---

## 六、L3 编排层（13 项规范 vs 现状）

| 规范项 | 现状 | 差距 |
|---|---|---|
| GenerationService | ❌ 缺失 | 需新建 `lib/ai/application/generation-service.ts` |
| TaskService | ⚠️ 部分（orchestrator 内部）| 需抽离为独立 service |
| FeatureService | ⚠️ 部分（service-registry）| 需重构为 handler registry |
| CostService | ⚠️ 部分（power.ts）| 需独立 + reservation 协调 |
| ResultService | ❌ 缺失 | 需新建 |
| FeatureOrchestrator | ✅ 已建 | 基本符合 |
| ExecutionPlan | ⚠️ 部分（orchestrator.execute 入参）| 需独立 type + 持久化 |
| RoutingPolicy | ⚠️ 部分（orchestrator 内 fallback chain）| 需独立 + 多维评分 |
| RetryPolicy | ✅ 已有（BullMQ attempts）| 需细化（仅 transient errors）|
| FallbackPolicy | ✅ 已有 | 需规则化（mock 不是 prod fallback）|
| TimeoutPolicy | ❌ 缺失 | 需新建 |
| FeatureHandler<TInput, TOutput> | ❌ 缺失 | 17 service files 需改造为 handlers |
| TaskStateMachine | ⚠️ 分散 | 需集中（ADR-011）|
| Provider Health Registry | ⚠️ 部分 | 需独立 + 5 状态（healthy/degraded/open/half_open/disabled）|
| Mock Executor 仅非生产 | ⚠️ 需明确禁用 | ADR-010 强制 |

---

## 七、部署与运行时（11 条要求 vs 现状）

| 规范项 | 现状 | 状态 |
|---|---|---|
| Docker Desktop + WSL2 + Docker CLI | ✅ 已有 | 0 |
| 移除 OnePanel | ⚠️ 仍有 `1PANEL-DEPLOYMENT-GUIDE.md` 和 `deploy-kit/` | 待清理 |
| Docker Compose 为唯一编排 | ✅ 已有（docker-compose.yml）| 0 |
| 服务名网络（service-name）| ✅ 已有 | 0 |
| 健康检查（PostgreSQL/Redis/Web/Worker）| ✅ 已有 | 0 |
| `restart: unless-stopped` | ✅ 已有 | 0 |
| 优雅关闭（SIGTERM）| ✅ Worker 已实现 | Web 未验证 |
| ComfyUI 集成（永不从前端/API 直连）| ✅ 已隔离 | 0 |
| 监控指标（队列深度/完成率/失败率/等待时间/执行时间）| ⚠️ 部分（health-worker）| 待补 Prometheus exporter |
| 备份策略 | ❌ 缺失 | 阻塞项 |
| 负载独立扩展（Web/Worker/ComfyUI）| ⚠️ 已有 Compose，未实测 | 待压测 |

---

## 八、Agent 编码标准（10 项规则）

| 规则 | 现状 |
|---|---|
| ✅ 不得删测试 | 保留 159 通过 |
| ✅ 不得跨层（详见 §2.1）| 部分越界待修 |
| ✅ 文件 kebab-case / 类 PascalCase | 当前混合（部分 PascalCase 文件如 `Sidebar.tsx`）|
| ✅ 用 Repository 模式 | 部分（tasks/works 等是 Drizzle 直接调用）|
| ✅ 错误码 catalog | 需统一 16 个标准错误码 |
| ✅ 幂等性（防双扣费）| **缺失**，高优先级 |
| ✅ 测试覆盖（unit/route/repo/state/idempotency/Redis reconnect/PG reconnect/executor fallback）| 需补 6 类 |
| ✅ 不重构无关代码 | 已遵守 |
| ✅ Mock 仅非生产 | 需明确禁用 |
| ✅ 完整变更报告 | 本会话已逐步建立 |

---

## 九、9 阶段迁移计划（当前进度）

| Phase | 主题 | 状态 | 已完成项 |
|---|---|---|---|
| 0 | 基线 | ⚠️ 部分 | git commit 记录 ✓，tests 记录 ✓，**route inventory 缺** |
| 1 | 运行时稳定 | ⚠️ 部分 | Docker Compose ✓，service-name ✓，healthcheck ✓，**OnePanel 残留** |
| 2 | API 基础 | ❌ 未开始 | response envelope 部分，**idempotency 缺** |
| 3 | GenerationService | ❌ 未开始 | pipeline.execute 需迁到 service |
| 4 | 编排重构 | ⚠️ 部分 | FeatureOrchestrator ✓，executor ports 部分 |
| 5 | 数据与运行时配置 | ⚠️ 部分 | `_tables.ts` 单文件，**需按 domain 拆分** |
| 6 | Power Ledger | ❌ 未开始 | power_transactions ✓，**power_reservations 缺** |
| 7 | 前端元数据迁移 | ⚠️ 部分 | Sidebar useFeatures ✓，**WorkspacePanel 未完全 registry 化** |
| 8 | 可观测性 | ⚠️ 部分 | health-worker ✓，**缺 Prometheus exporter** |
| 9 | 强化 | ❌ 未开始 | 缺压测/重连/取消测试 |

---

## 十、迁移优先级矩阵

### 🔴 P0 — 必须做（架构基础）

1. **生成 route inventory**（92 路由的现状清单，迁移基线）
2. **建立 withRequestContext + withIdempotency 中间件**（防双扣费 + 统一 trace）
3. **拆分 `_tables.ts` 为 domain schema 文件**（users/features/tasks/works 等）
4. **新建 GenerationService**（合并 pipeline.execute，统一 lifecycle）
5. **集中 TaskStateMachine**（ADR-011）
6. **添加幂等键约束**（user + feature + params hash → unique）

### 🟠 P1 — 高价值

7. **新建 feature_categories / generations / assets / power_reservations / workflow_versions / providers / provider_credentials 7 张新表**
8. **WorkspacePanel 完全 registry 化**（去除 17 项硬编码）
9. **补 executor port**（4 个 mock / third-party / comfyui 全部走统一接口）
10. **SideBar 完全元数据驱动**（移除硬编码的 4 个 group + 17 个 id）
11. **新建 `src/features/` 产品模块目录**（feature-catalog/generation/task-history/works/favorites/power）
12. **移除 OnePanel 残留**（删 `1PANEL-DEPLOYMENT-GUIDE.md` + `deploy-kit/`）

### 🟡 P2 — 优化

13. **统一 API 错误码**（16 个标准 code）
14. **生产环境禁用 Mock Executor**（ADR-010）
15. **Provider Health Registry**（5 状态机）
16. **拆 `src/lib/ai-gateway/` → `src/lib/ai/adapters/`**
17. **拆 `src/lib/orchestrator/` → `src/lib/ai/orchestration/`**
18. **拆 `src/lib/queue/` → `src/lib/ai/queue/`**
19. **Prometheus exporter**（在 health-worker 旁加一个）
20. **加 load/cancel/timeout 集成测试**

### 🟢 P3 — 长期

21. **IService 容器化 runtime 化**（compose.dev / compose.prod / compose.gpu 拆分）
22. **CD 流水线**（GitHub Actions / GitLab CI）
23. **压测基线 + SLO**（p95/p99 目标）
24. **A11y/i18n**

---

## 十一、关键风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| **幂等性缺失**（重复提交双扣费）| 资损 + 用户投诉 | P0 withIdempotency 中间件 |
| **powled 表无 reservation** | 失败任务扣费不退还 | P1 power_reservations 表 |
| **ComfyUI 仍可能在某路径直连** | 违规 L1→L5 隔离 | Phase 4 编排重构 |
| **92 路由无 inventory** | 迁移无基线，删除风险高 | P0 立即生成 |
| **Mock 生产误用**（ADR-010）| 资损 + 计费错乱 | P2 显式禁用 |
| **OnePanel 残留** | 部署冲突 | 清理 deploy-kit + 1PANEL 文档 |
| **测试 159 vs 179 缺口 20** | 回归风险 | 6 类测试补充 |

---

## 十二、推荐立即行动

**今天（4-6 小时，1 个 agent）**：
1. 生成 `docs/architecture/ROUTE-INVENTORY.md`（92 路由的完整清单）
2. 生成 `docs/architecture/SCHEMA-MAPPING.md`（当前 19 表 vs 规范 19 表的映射）
3. 实现 `withRequestContext + withIdempotency` 中间件
4. 在 `next.config.ts` 加 `output: 'standalone'`

**本周（2-3 天）**：
5. 拆分 `_tables.ts` 为 domain schema
6. 新建 `GenerationService`（合并 pipeline.execute）
7. 集中 `TaskStateMachine`
8. 创建 7 张新表

**两周（PRD 范围）**：完成 Phase 2-3

**两月（Roadmap 范围）**：完成 Phase 1-9

---

## 十三、结论

**这是一份**严肃、完整、与现状高度兼容**的架构升级方案**：

- ✅ 与当前项目**不冲突**（保留 17/92/19/159 全部基线）
- ✅ 与本会话已完成的工作**协同**（5 层架构 + 后台运维中心 + 模型中心 + 告警）
- ⚠️ 需要**严肃推进的 6 个 P0 阻塞**（幂等、inventory、schema 拆分、GenerationService、StateMachine、route group）
- ⚠️ 现有 305 ESLint 警告 + 159 测试（vs 179 目标）+ OnePanel 残留**是技术债务**

**核心结论**：新架构 v2.0 不是"重写"，而是**增量重构**——保留 17/92/19/159 基线，**补足 8 张缺失表** + **新建 L3 application services** + **统一 API 中间件**。

**建议路线**：分 9 阶段迁移（与 `11-Migration-Plan.md` 完全对齐），**每阶段可独立回滚**。我建议先做 Phase 0-1（基线 + 运行时稳定），约 1 周工作量。
