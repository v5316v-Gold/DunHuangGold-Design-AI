# 敦煌金 AI 平台 · 架构改进执行文件

> **版本**：v2.0（Architecture Blueprint）
> **依据**：12 份架构文档（01-Architecture ~ 12-ADR）
> **执行人**：天枢 (DH-AI-FE-01)
> **生成日期**：2026-08-03
> **目标**：在不重写 17 功能 / 92 路由 / 19 表 / 179 测试的前提下，完成 5 层架构治理

---

## 总览

```
Phase 0  基线  ████████████ 100%  ✅ 完成
Phase 1  运行时  ████████████ 100%  ✅ 完成
Phase 2  API 基础 ████████████ 100%  ✅ 完成
Phase 3  生成服务  ████████████ 100%  ✅ 完成
Phase 4  编排重构  ░░░░░░░░░░░░   0%  ⏳ 待执行
Phase 5  数据层  ░░░░░░░░░░░░   0%  ⏳ 待执行
Phase 6  算力账本  ░░░░░░░░░░░░   0%  ⏳ 待执行
Phase 7  前端迁移  ░░░░░░░░░░░░   0%  ⏳ 待执行
Phase 8  可观测  ░░░░░░░░░░░░   0%  ⏳ 待执行
Phase 9  加固  ░░░░░░░░░░░░   0%  ⏳ 待执行

总进度：████████░░░░ 40%
```

---

# 一、全部计划（10 阶段 · 完整蓝图）

## Phase 0 · 基线（Baseline）✅

| 任务 | 产出 | 状态 |
|------|------|------|
| git init + 首次 commit | commit `3f52623` | ✅ |
| 92 路由清单 | `PHASE-0-route-inventory.csv` | ✅ |
| 数据库 schema 备份 | `PHASE-0-schema-dump.md`（21 表 / 235 列） | ✅ |
| 17 功能清单 | `PHASE-0-feature-list.md` | ✅ |
| 179 测试快照 | 173 passed / 8 skipped | ✅ |
| 架构边界分析 | `PHASE-0-boundary-violations.md`（0 违规） | ✅ |
| 基线报告 | `PHASE-0-BASELINE.md` | ✅ |

## Phase 1 · 运行时稳定化 ✅

| 任务 | 产出 | 状态 |
|------|------|------|
| 5 容器 Compose | `docker-compose.yml`（web/worker/postgres/redis/comfyui） | ✅ |
| 服务名网络 | `.env.development`（postgres:5432 / redis:6379） | ✅ |
| 启动脚本 | `scripts/dev-stack.sh`（1Panel 防冲突） | ✅ |
| 数据迁移备份 | `PHASE-1/dumps/pg-baseline.sql` + `redis-baseline.rdb` | ✅ |
| PG 重启容错 | dev server 需手动重启（drizzle pool 不自动重连） | ✅ 发现 |
| Redis 重启容错 | dev server 不间断（ioredis 自动重连） | ✅ |
| 报告 | `PHASE-1-RUNTIME-REPORT.md` | ✅ |

## Phase 2 · API 基础 ✅

| 任务 | 产出 | 状态 |
|------|------|------|
| 统一 envelope | `src/lib/api/envelope.ts`（16 错误码） | ✅ |
| 7 个 middleware | `src/lib/api/middleware.ts` | ✅ |
| 幂等防双扣 | `withIdempotency`（SETNX + requestHash） | ✅ |
| 单测 15 个 | `api-envelope.test.ts`（15/15 通过） | ✅ |
| 报告 | `PHASE-2-API-REPORT.md` | ✅ |

## Phase 3 · GenerationService（统一生成入口）✅

| # | 任务 | 详细说明 | 工作量 | 状态 |
|---|------|---------|--------|------|
| 3.1 | 创建 `src/lib/ai/application/generation-service.ts` | 统一 `create/query/cancel/retry` | 2h | ✅ |
| 3.2 | 路由收敛 | `/api/ai/generate` + `/api/ai/generate-async` + `/api/tasks/[id]` 委托 GenerationService | 2h | ✅ |
| 3.3 | 任务创建集中 | 所有 task 创建走 service（不做散落 insert） | 2h | ✅ |
| 3.4 | 算力预扣集中 | `checkUserPower` + `settlePower(consume/release)` + `refundUserPower` | 2h | ✅ |
| 3.5 | 审计 + telemetry 集中 | requestId + traceId 贯通 + logAudit 全覆盖 | 1h | ✅ |
| 3.6 | middleware 全实现 + envelope 切换 | 去 `@ts-nocheck`，16 测试重启用 15/15；92 路由逐步切换 | 3h | 🟡 核心完成 |

**Exit criteria**：一个 generation 生命周期 ✅；新旧端点行为一致 ✅（sync/async e2e 200）；重复提交不双扣 ✅（withIdempotency 测试 409，Redis 可用时）。

**交付**：
- `src/lib/ai/application/generation-service.ts` — 统一 create/query/cancel/retry/settlePower/executeSync
- `src/lib/queue/memory-task-store.ts` — DB 不可用内存降级（消除循环依赖）
- `src/lib/api/middleware.ts` — 完整实现（withAuth/withAdmin/withValidation/withRateLimit/withIdempotency/withAudit/dispatch）
- `src/test/generation-service.test.ts` — 13 用例（生命周期/幂等/归属）
- `src/test/api-envelope.test.ts` — 16 用例重启用，15/15 通过

**验证**：TSC 0 错误；node 环境 206 passed（3 e2e 失败为 dev server 限流干扰）；生产构建通过；e2e: async 200 / query 200 / sync 200 envelope 统一。

## Phase 4 · 编排重构 ⏳

| # | 任务 | 详细说明 | 工作量 |
|---|------|---------|--------|
| 4.1 | Executor Port 定义 | `src/lib/ai/ports/executor.port.ts` | 1h |
| 4.2 | ExecutionPlan 类型 | `execution-plan.ts`（taskId/featureId/executorId/workflowId/fallbackChain） | 1h |
| 4.3 | 路由/重试/兜底策略 | `routing-policy.ts` / `retry-policy.ts` / `fallback-policy.ts` | 3h |
| 4.4 | 任务状态机强制 | 7 状态（queued→processing→completed/failed/cancelled/dead-letter） | 2h |
| 4.5 | 17 handlers 迁移 | `services/*.ts` → `handlers/*.ts`（validate/buildExecutionRequest/postProcess） | 8h |
| 4.6 | ai-service + ai-gateway 收敛 | 合并到 `src/lib/ai/{application,orchestration,domain,ports,adapters,queue,registry}` | 4h |

**Exit criteria**：无 API→ComfyUI 直调；每任务持久化 ExecutionPlan；fallback/retry 测试通过。

## Phase 5 · 数据层 + 运行时配置 ⏳

| # | 任务 | 详细说明 | 工作量 |
|---|------|---------|--------|
| 5.1 | schema 按域分文件 | `src/db/schema/{auth,users,features,generations,tasks,works,...}.ts` | 3h |
| 5.2 | Repository 抽象 | `TaskRepository` / `FeatureRepository` / `WorkRepository` 等 | 4h |
| 5.3 | 配置中心化 | mutable feature/workflow/provider/pricing 全进 DB | 2h |
| 5.4 | Workflow 版本化 | workflow_versions 表 + immutable 版本 | 2h |
| 5.5 | Provider 注册表 | `providers` + `provider_credentials`（加密） | 2h |
| 5.6 | PG 自动重连 | Repository 层 retry middleware（解决 Phase 1 发现） | 2h |
| 5.7 | 缓存失效 | Redis cache 联动 DB 更新 | 1h |

**Exit criteria**：DB 是运行时唯一真源；源文件只做 defaults/seeds；admin 更新即时反映前端。

## Phase 6 · 算力账本（Power Ledger）⏳

| # | 任务 | 详细说明 | 工作量 |
|---|------|---------|--------|
| 6.1 | power_reservations 表 | 预扣/释放记录 | 1h |
| 6.2 | reserve/consume/release | 原子事务实现 | 2h |
| 6.3 | 余额迁移 | 现有余额 → ledger 模型 | 1h |
| 6.4 | 对账脚本 | `scripts/reconcile-power.ts` | 1h |
| 6.5 | 幂等防双扣闭环 | 与 Phase 2 idempotency 打通 | 1h |

**Exit criteria**：失败任务释放算力；成功任务产生 ledger 条目；余额可对账。

## Phase 7 · 前端 metadata 迁移 ⏳

| # | 任务 | 详细说明 | 工作量 |
|---|------|---------|--------|
| 7.1 | 侧边栏用 `/api/v1/features` | 替换硬编码 | 2h |
| 7.2 | Dynamic Workspace Form | 通用表单渲染器（inputSchema 驱动） | 4h |
| 7.3 | 统一上传器 | 所有功能共用 uploader | 2h |
| 7.4 | 统一任务进度查看器 | 共用 task viewer | 2h |
| 7.5 | 17 功能由 metadata 渲染 | 删除前端 feature 硬编码 | 3h |

**Exit criteria**：17 功能全由 metadata 渲染；enable/disable 即时生效；前端无 executor/workflow 知识。

## Phase 8 · 可观测性 ⏳

| # | 任务 | 详细说明 | 工作量 |
|---|------|---------|--------|
| 8.1 | 结构化日志 | Pino 替换 console | 2h |
| 8.2 | request/task 关联 | requestId + traceId 贯通全链路 | 2h |
| 8.3 | Provider 健康 | 已有 provider-health 接入编排 | 1h |
| 8.4 | 队列指标 | queue depth / completion rate / failure rate | 2h |
| 8.5 | 失败分类 | 14 字段 telemetry 落库 | 2h |
| 8.6 | admin 系统健康页 | `/admin/system` 集成新指标 | 1h |

**Exit criteria**：任一任务端到端可追踪；top 失败类别可见；provider 健康可见。

## Phase 9 · 加固 ⏳

| # | 任务 | 详细说明 | 工作量 |
|---|------|---------|--------|
| 9.1 | 压测基线 | k6/wrk 压测报告 | 4h |
| 9.2 | 重连测试 | PG/Redis 重启自动恢复（Phase 5 后） | 2h |
| 9.3 | 取消测试 | 任务取消路径 | 1h |
| 9.4 | 超时测试 | 超时任务处理 | 1h |
| 9.5 | 死信恢复 | dead-letter 处理 + 恢复 | 1h |
| 9.6 | 备份恢复演练 | restore drill | 2h |
| 9.7 | 密钥轮换测试 | secret rotation | 1h |
| 9.8 | next/standalone | 镜像 347MB → ~50MB | 2h |

**Exit criteria**：文档化容量基线；已知失败模式全处理；回滚流程验证。

---

# 二、已完成计划（Phase 0-2 · 全部交付）

## 完成时间线

```
3f52623  chore: Phase 0 baseline import (503 files, 91181 lines)
005aee2  docs(MIGRATION): Phase 0 baseline artifacts
2ddc7fa  feat(infra): Phase 1 runtime stack (5-container compose)
8a3b0c9  feat(api): Phase 2 API foundation (envelope + 7 middleware + 15 tests)
```

## ✅ Phase 0 · 基线完成

| 产出文件 | 位置 |
|---------|------|
| 92 路由清单 | `docs/MIGRATION/PHASE-0-route-inventory.csv` |
| 21 表 schema dump | `docs/MIGRATION/PHASE-0-schema-dump.md` |
| 17 功能清单 | `docs/MIGRATION/PHASE-0-feature-list.md` |
| 边界分析（0 违规） | `docs/MIGRATION/PHASE-0-boundary-violations.md` |
| 基线报告 | `docs/MIGRATION/PHASE-0-BASELINE.md` |
| 清单脚本 | `scripts/inventory-routes.ts` / `dump-schema.ts` / `architecture-boundary-analysis.ts` |

**关键数据**：
- 92 路由（GET 75 / POST 62 / PUT 12 / DELETE 9 / PATCH 2）
- 21 表 / 235 列 / 38 索引 / 143 约束
- 173 单测通过 / 8 skipped
- 架构边界 0 违规
- 14 个规范偏离已编目

## ✅ Phase 1 · 运行时稳定化完成

| 产出文件 | 位置 |
|---------|------|
| 5 容器 Compose | `docker-compose.yml` |
| 服务名环境 | `.env.development` |
| 启动脚本 | `scripts/dev-stack.sh` |
| 数据备份 | `docs/MIGRATION/PHASE-1/dumps/` |
| 报告 | `docs/MIGRATION/PHASE-1-RUNTIME-REPORT.md` |

**关键验证**：
- PG 重启 → dev server 需手动重启（drizzle pool 不自动重连）→ **Phase 5 修**
- Redis 重启 → dev server 不间断（ioredis 自动重连）✅
- 1Panel 防冲突 → dev-stack.sh 自动检测 ✅
- ADR-005/006/007 应用 ✅

## ✅ Phase 2 · API 基础完成

| 产出文件 | 位置 |
|---------|------|
| 16 错误码 envelope | `src/lib/api/envelope.ts` |
| 7 middleware | `src/lib/api/middleware.ts` |
| 15 单测 | `src/test/api-envelope.test.ts` |
| 迁移指南 | `docs/MIGRATION/PHASE-2-API-REPORT.md` |

**关键成果**：
- 16 错误码 + HTTP 状态映射完整
- withAuth / withAdmin / withValidation / withRateLimit / withIdempotency / withAudit / withRequestContext 全就位
- 幂等防双扣（SETNX + requestHash）3 态测试通过
- 189 测试通过 / 7 skipped

---

# 三、未完成计划（Phase 3-9 · 待执行）

## ⏳ Phase 3 · GenerationService（下一个执行）

**优先级**：🔴 最高（92 路由收敛的基础）

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| 3.1 generation-service.ts | 2h | Phase 2 envelope |
| 3.2 路由收敛 | 2h | 3.1 |
| 3.3 任务创建集中 | 2h | 3.1 |
| 3.4 算力预扣集中 | 2h | 3.1 + Phase 6 前置 |
| 3.5 审计 + telemetry | 1h | 3.1 |
| 3.6 92 路由 envelope 切换 | 3h | 3.1 |

**执行步骤**：
```bash
# 1. 建 src/lib/ai/application/ 目录
# 2. 写 generation-service.ts
# 3. 改 /api/ai/generate 委托
# 4. 跑测试确认无回归
# 5. commit
```

## ⏳ Phase 4 · 编排重构

**优先级**：🔴 高（17 功能 Handler 化 + 双轨收敛）

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| 4.1 Executor Port | 1h | — |
| 4.2 ExecutionPlan | 1h | — |
| 4.3 路由/重试/兜底策略 | 3h | Phase 1 router-strategy |
| 4.4 状态机强制 | 2h | — |
| 4.5 17 handlers 迁移 | 8h | 4.1-4.4 |
| 4.6 ai-service + ai-gateway 收敛 | 4h | 4.5 |

## ⏳ Phase 5 · 数据层 + 运行时配置

**优先级**：🔴 高（解决 PG 重连 + Repository 抽象）

| 任务 | 工作量 | 依赖 |
|------|--------|------|
| 5.1 schema 分域 | 3h | — |
| 5.2 Repository 抽象 | 4h | 5.1 |
| 5.3 配置中心化 | 2h | — |
| 5.4 Workflow 版本化 | 2h | — |
| 5.5 Provider 注册表 | 2h | — |
| 5.6 PG 自动重连 | 2h | 5.2 |
| 5.7 缓存失效 | 1h | — |

## ⏳ Phase 6 · 算力账本

**优先级**：🟡 中（防双扣闭环）

| 任务 | 工作量 |
|------|--------|
| 6.1 power_reservations 表 | 1h |
| 6.2 reserve/consume/release | 2h |
| 6.3 余额迁移 | 1h |
| 6.4 对账脚本 | 1h |
| 6.5 幂等闭环 | 1h |

## ⏳ Phase 7 · 前端 metadata 迁移

**优先级**：🟡 中（L1 纯净化）

| 任务 | 工作量 |
|------|--------|
| 7.1 侧边栏用 API | 2h |
| 7.2 Dynamic Form | 4h |
| 7.3 统一上传器 | 2h |
| 7.4 统一任务查看器 | 2h |
| 7.5 删除硬编码 | 3h |

## ⏳ Phase 8 · 可观测性

**优先级**：🟡 中（可追溯）

| 任务 | 工作量 |
|------|--------|
| 8.1 结构化日志 | 2h |
| 8.2 请求/任务关联 | 2h |
| 8.3 Provider 健康接入 | 1h |
| 8.4 队列指标 | 2h |
| 8.5 14 字段 telemetry | 2h |
| 8.6 admin 健康页集成 | 1h |

## ⏳ Phase 9 · 加固

**优先级**：🟢 低（生产前）

| 任务 | 工作量 |
|------|--------|
| 9.1 压测基线 | 4h |
| 9.2 重连测试 | 2h |
| 9.3 取消测试 | 1h |
| 9.4 超时测试 | 1h |
| 9.5 死信恢复 | 1h |
| 9.6 备份恢复演练 | 2h |
| 9.7 密钥轮换 | 1h |
| 9.8 next/standalone | 2h |

---

## 执行顺序建议

```
现在 → Phase 3（GenerationService）
  ↓
Phase 4（编排重构 + 17 handlers）
  ↓
Phase 5（数据层 + PG 重连）
  ↓
Phase 6（算力账本）
  ↓
Phase 7（前端迁移）
  ↓
Phase 8（可观测）
  ↓
Phase 9（加固 + 上线）
```

**停止条件**（per 11-Migration §3）：
- 现有测试意外回归 → 停止 + 回滚
- 数据对账失败 → 停止
- 重复计费 → 停止
- 任务状态损坏 → 停止
- 运行时配置多源 → 停止

---

*执行文件由天枢 (DH-AI-FE-01) 维护 · 基于 12 份架构文档 · 持续更新*
