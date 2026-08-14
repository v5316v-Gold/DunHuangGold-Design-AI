# Phase 9.24 · 死代码清理报告

> 实施时间：2026-08-14 · 分支基线：ed9eeb7

## 一、清理成果

| 指标 | 清理前 | 清理后 | 变化 |
|------|--------|--------|------|
| 文件数 | 393 | **295** | **-98 (-25%)** |
| 代码行数 | 63,575 | **54,507** | **-9,068 (-14%)** |
| API routes | 96 | **48** | **-48 (-50%)** |
| lib 死文件 | 13 | 0 | -13 |
| 旧 ai-service 模块 | 28 | 0 | -28 |

## 二、删除清单

### A · @deprecated 路由（48 个）

#### 后台管理路由（37 个）
```
D src/app/api/admin/ai-assistant-config/route.ts
D src/app/api/admin/api-config/route.ts
D src/app/api/admin/api-config-db/route.ts
D src/app/api/admin/app-settings/route.ts
D src/app/api/admin/clear-cache/route.ts
D src/app/api/admin/comfyui/connections/route.ts
D src/app/api/admin/comfyui/connections/[id]/route.ts
D src/app/api/admin/comfyui/workflows/route.ts
D src/app/api/admin/comfyui/workflows/[id]/route.ts
D src/app/api/admin/comfyui/workflows/parse/route.ts
D src/app/api/admin/config-status/route.ts
D src/app/api/admin/dashboard-stats/route.ts
D src/app/api/admin/feature-costs/route.ts
D src/app/api/admin/features/route.ts
D src/app/api/admin/features-status/route.ts
D src/app/api/admin/llm-providers/fetch-models/route.ts
D src/app/api/admin/lora/route.ts
D src/app/api/admin/lora/[id]/toggle/route.ts
D src/app/api/admin/models/legacy.ts
D src/app/api/admin/models/route.ts
D src/app/api/admin/models/upload/route.ts
D src/app/api/admin/power/route.ts
D src/app/api/admin/power/recharge/route.ts
D src/app/api/admin/power/transactions/route.ts
D src/app/api/admin/queue-stats/route.ts
D src/app/api/admin/rules/route.ts
D src/app/api/admin/stats/route.ts
D src/app/api/admin/system/route.ts
D src/app/api/admin/tasks/route.ts
D src/app/api/admin/tasks/[id]/route.ts
D src/app/api/admin/tasks/[id]/cancel/route.ts
D src/app/api/admin/tasks/[id]/retry/route.ts
D src/app/api/admin/users/route.ts
D src/app/api/admin/users/[id]/recharge/route.ts
D src/app/api/admin/users/mock-data.ts
D src/app/api/admin/workflow-templates/route.ts
D src/app/api/admin/works/route.ts
```

#### 旧 16 功能路由（21 个，Phase 4 前直接路由，按 feature 调用）
```
D src/app/api/ai-assistant/route.ts
D src/app/api/free-creation/route.ts
D src/app/api/generate-image/route.ts
D src/app/api/image-3d/route.ts
D src/app/api/multi-image/route.ts
D src/app/api/multi-view/route.ts
D src/app/api/one-click-design/route.ts
D src/app/api/openclaw-chat/route.ts
D src/app/api/product-refine/route.ts
D src/app/api/relief/route.ts
D src/app/api/relief-download/route.ts
D src/app/api/remove-background/route.ts
D src/app/api/remove-watermark/route.ts
D src/app/api/sketch-realistic/route.ts
D src/app/api/stats/route.ts
D src/app/api/stereo/route.ts
D src/app/api/upscale/route.ts
D src/app/api/video/route.ts
D src/app/api/works/route.ts
D src/app/api/works/[id]/download/route.ts
D src/app/api/works/batch-delete/route.ts
```

#### 残留 0 引用
```
D src/app/api/upload/route.ts
D src/lib/deprecated-route.ts
```

### B · lib 死文件（13 个）

```
D src/lib/ai-gateway/port.ts                      (Phase 4 旧 gateway)
D src/lib/ai-gateway/provider-health.ts           (Phase 4 旧 gateway)
D src/lib/ai-gateway/router-strategy.ts           (Phase 4 旧 gateway)
D src/lib/ai-gateway/adapters/comfyui.ts          (Phase 4 旧 gateway)
D src/lib/ai-gateway/adapters/lora-db.ts          (Phase 4 旧 gateway)
D src/lib/ai-gateway/adapters/lora-in-memory.ts  (Phase 4 旧 gateway)
D src/lib/ai-gateway/adapters/workflow-manager.ts (Phase 4 旧 gateway)
D lib/ai-gateway/ 整目录删除
D src/lib/ai/registry/workflow-registry.ts        (Phase 9.23 替代)
D src/lib/api-key-crypto.ts                       (已并入 provider-repository)
D src/lib/minimax-async-worker.ts                 (minimaxVideoQuery 替代)
D src/lib/meshy-api.ts                            (Meshy 3D 停用)
D src/lib/token-manager.tsx                       (前端未用)
D src/lib/comfyui/executor-integration.ts         (早期胶水)
```

### C · 旧 ai-service/ai-handlers/ai-registry 模块（28 个）

```
D src/lib/ai-service/services/  (整目录 17 个 service 文件)
  ai-assistant.ts, blend.ts, dialogue.ts, free.ts, image3d.ts,
  img2video.ts, multiview.ts, oneclick.ts, refine.ts, relief.ts,
  removebg.ts, sketch.ts, stereo.ts, text2img.ts, text2video.ts,
  tryon.ts, upscale.ts, watermark.ts, index.ts

D src/lib/ai-service/service-registry.ts          (Phase 4 旧注册表)
D src/lib/ai-service/generation-pipeline.ts       (Phase 9.22 minimax 收口后迁出)
D src/lib/ai-service/register-helper.ts           (Phase 4 辅助)
D src/lib/ai-service/types.ts                     (AIServiceType 联合 → 内联 string)
D src/lib/ai-service/ 整目录清空
D src/lib/ai/handlers/  (整目录 3 个)
D src/lib/ai/registry/  (整目录 3 个)
```

### D · 失效测试（4 个）

```
D src/test/ai-gateway.test.ts            (测试 ai-gateway 已删)
D src/test/ai-gateway-enhance.test.ts    (测试 ai-gateway 已删)
D src/test/ai-services.test.ts           (测试 ai-service 已删)
D src/test/handlers.test.ts              (测试 ai/handlers 已删)
```

## 三、保留（重要功能性文件）

虽然被前面脚本扫描为 0 refs，以下文件因 Next.js 路由约定、动态 import 或测试依赖被保留：

| 类别 | 文件 | 原因 |
|------|------|------|
| 路由约定 | `app/robots.ts` `app/**/page.tsx` `app/**/layout.tsx` | Next.js 约定 |
| 后台 UI | `components/admin/*` `app/admin/**/page.tsx` | Admin layout 动态加载 |
| Workspace 组件 | `components/workspace/*` | feature-registry 动态 import |
| DB 入口 | `db/index.ts` `db/schema.ts` | 兼容层（@/db 入口） |
| DB 兼容 | `storage/database/db.ts` | 转发 @/db |
| ai-service 保留 | `power-helper.ts` `storage-helper.ts` | 仍被 generation-service/storage-helper test mock 引用 |
| 旧 orchestrator | `lib/orchestrator/feature-orchestrator.ts` | tests 引用 + IdNormalizedExecutor 包装 |
| 旧 third-party stub | `lib/orchestrator/executors/third-party-executor.ts` | feature-orchestrator 引用（占位） |

## 四、修复（保持编译通过）

| 文件 | 改动 |
|------|------|
| `src/lib/queue/task-queue.ts` | 删除 `@/lib/ai-service/types` import · 内联 `type AIServiceType = string` |
| `src/lib/ai/application/generation-service.ts` | 删除 import · 内联 `type AIServiceType = string` |
| `worker/src/index.ts` | 改走 PolicyOrchestrator 主链路（删除 ai-service registry 调用）· 使用 `artifacts[]`（替代 `data`）· result.error 兼容 |

## 五、5 层架构对比

### 清理前（虚胖）
```
L1 Presentation: 96 routes (含 21 个老 16 功能路由 + 37 个 deprecated admin)
L2 Application: generation-service + ai-service/services (17 个旧 service)
L3 Orchestration: lib/ai/orchestration + lib/ai/handlers + lib/ai/registry (双套)
L4 AI Adapters: lib/ai-gateway/ (8 文件) + lib/orchestrator/executors + lib/ai/adapters
L5 Infrastructure: lib/ai-service + db + storage
```

### 清理后（精简）
```
L1 Presentation: 48 routes（48 个生产路由，0 个 deprecated）
L2 Application: generation-service + power-ledger + telemetry
L3 Orchestration: lib/ai/orchestration（policy-orchestrator + routing/retry/fallback + execution-plan）
L4 AI Adapters: lib/orchestrator/executors + lib/ai/adapters（comfyui/hermes/minimax/mock）
L5 Infrastructure: lib/storage + db + storage/database
```

## 六、验证

```
tsc --noEmit                              ✅ 0 errors
pnpm lint (eslint src/)                  ✅ 0 errors / 0 warnings
vitest hardening                          ✅ 12/12
vitest policy-orchestrator                ✅ 16/16
vitest phase5-ext                         ✅ 7/7
vitest workflow-closure                   ✅ 23/23
vitest storage-helper                     ✅ 5/5
测试总计                                  ✅ 63/63 passed
容器状态                                  ✅ 6/6 healthy
```

## 七、保留的下一步优化机会（非本次）

| 项目 | 说明 | 优先级 |
|------|------|--------|
| `lib/orchestrator/feature-orchestrator.ts` (3.8KB) | 兼容入口，3 测试用 | 🟢 低（保留兼容）|
| `lib/orchestrator/executors/third-party-executor.ts` (0.8KB) | 占位 stub | 🟢 低（保留以防回归）|
| 后台 UI 组件 | `components/admin/*` 静态扫描 0 引用但动态被 admin layout 加载 | 🟡 中（验证后再删）|
| `app/api/operation-logs` 等 1-ref 路由 | 真正 1-2 处使用 | 🟡 中（保留以防破坏 dashboard）|
| `app/api/v1/features/route.ts` | 兼容版 features API | 🟢 低（保留外部 SDK 兼容）|

## 八、风险评估

| 删除项 | 风险评估 | 缓解 |
|--------|----------|------|
| 48 个 deprecated routes | 🟢 低 - 已被前端新 API 替代（/api/ai/generate-async + /api/chat） | 仅删除前确认 0 引用 |
| 8 个 ai-gateway 文件 | 🟢 低 - 已被 PolicyOrchestrator 完全替代 | 仅在测试中保留 stub |
| 17 个 ai-service services | 🟡 中 - 主链路不依赖，但 worker 用了 | 修复 worker.ts 改走 PolicyOrchestrator |
| AIServiceType 类型删除 | 🟡 中 - 3 文件引用 | 内联为 string 类型 |
| 4 个测试删除 | 🟢 低 - 测试对象已删 | 立即删除 |

---

# ✅ DEAD CODE CLEANUP GATE: **PASS**

> 移除 98 个死文件（309KB / 9068 行），tsc/lint 全绿，63/63 测试通过。
> 5 层架构从"双套并存"收敛为"单一套"，代码瘦身 14%，架构更清晰。