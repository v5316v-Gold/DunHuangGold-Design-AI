# Phase 1-5 完整进度文档（2026-08-13）

> **目的**：下次启动新 agent 会话，**先读本文档**，再决定下一步。
> **约束**：main 为唯一基线，每阶段独立分支、单独验收；增量重构，不重写。

---

## 0. 1 分钟复盘（必读）

| 维度 | 状态 |
|------|------|
| **项目位置** | `D:\DunHuangGold-Design-AI-main`（MSYS 路径 `/d/DunHuangGold-Design-AI-main`）|
| **当前 main HEAD** | `a3a1ca8`（5 阶段 5 commit）|
| **远端 main HEAD** | `a3a1ca8`（已同步 GitHub，SSH push 走 22 端口）|
| **远端 URL** | `git@github.com:v5316v-Gold/DunHuangGold-Design-AI.git` |
| **Node** | 20.x（容器内）|
| **沙箱网络** | HTTPS 443 阻断、SSH 22 通；走 SSH push |
| **Docker 镜像** | `dunhuang-ai-dev-web:latest`（web 容器）、`dunhuang-worker:v2.0`（worker 容器）|
| **DB** | PostgreSQL 18.4-alpine（容器名 `dunhuang-postgres`）|

**5 阶段提交链（按时间顺序）**：
```
a3a1ca8  Phase 5.3 admin/api-config 1 处迁移 + ApiConfigsRepository
a120f63  Phase 5.2 WorkflowRegistry + features.workflow_id seed
23d0bd0  Phase 5.1 Repository 抽象 + 5 路由迁移
6941f23  Phase 4 编排层切换 worker 到 PolicyOrchestrator
f5b2ab1  Phase 1-3 收尾（安全+文档）
```

---

## 1. Phase 1-3 基础能力（已完成）

### 1.1 17 个前端功能

| ID | 名称 | 分类 | API 路由 | 默认执行器 |
|----|------|------|----------|-----------|
| text2img | 文案生图 | image | `/api/ai/generate` | third-party → comfyui → mock |
| product-refine | 产品精修 | image | 同上 | 同上 |
| multi-image | 多图融合 | image | 同上 | 同上 |
| one-click-design | 一键设计 | image | 同上 | 同上 |
| multi-view | 生成多视图 | image | 同上 | 同上 |
| sketch-realistic | 线稿/写实 | image | 同上 | 同上 |
| free-creation | 自由创作 | image | 同上 | 同上 |
| remove-background | 移除背景 | image | 同上 | 同上 |
| upscale | 高清放大 | image | 同上 | 同上 |
| remove-watermark | 去除水印 | image | 同上 | 同上 |
| relief | 浮雕图生成 | 3d | 同上 | comfyui |
| image-3d | 3D 模型生成 | 3d | 同上 | comfyui |
| 2dto3d | 图像转立体 | 3d | 同上 | comfyui |
| text2video | 文生视频 | video | 同上 | third-party |
| image2video | 图生视频 | video | 同上 | third-party |
| ai-chat | AI 对话 | chat | `/api/chat` | minimax/hermes 等 7 provider |
| tryon | 佩戴效果 | image | 同上 | comfyui |

### 1.2 关键架构组件

- **API 层**：`/api/ai/generate`（同步）+ `/api/ai/generate-async`（异步）
- **后台 10 tab**：数据概览、用户管理、作品审核、任务中心、算力管理、功能管理、模型中心、API 设置、提示词与规则、系统健康
- **数据库**：22 张表（users/features/apiConfigs/systemSettings/works/tasks/powerLogs 等）

### 1.3 关键修复

- 安全管理：`.env.development` 从 git 移除、JWT_SECRET/ENCRYPTION_KEY 不再硬编码（构建期占位 + 运行时注入）
- 文档统一：`docs/ARCHITECTURE.md`（单一口径）
- 15 个标记 `@deprecated` 路由保留为兼容层（**保留 rollback 能力，不删**）

---

## 2. Phase 4 编排层（已完成）

### 2.1 核心变化

- **Worker 切换**：`workers/orchestrator-worker.ts` 从老 `feature-orchestrator` 切到新 `policyOrchestrator`
- **同步路径**：`src/lib/ai/application/generation-service.ts` 的 `executeSync` 同步切换
- **老编排器**：标记 `@deprecated`（保留 rollback）
- **ComfyUI 超时保护**：`src/lib/comfyui-call-service.ts` 三个 fetch 加 `AbortSignal.timeout`（8s/8s/15s）

### 2.2 新架构（**已有**）

| 文件 | 用途 |
|------|------|
| `src/lib/ai/ports/executor.port.ts` | Executor Port 接口（mock/comfyui/third-party）|
| `src/lib/ai/domain/execution-plan.ts` | ExecutionPlan + ExecutionTrace 域模型 |
| `src/lib/ai/orchestration/policy-orchestrator.ts` | 策略驱动编排器（routing/retry/fallback + Plan 追踪）|
| `src/lib/ai/orchestration/routing-policy.ts` | 路由策略（默认 ['third-party','comfyui','mock']）|
| `src/lib/ai/orchestration/retry-policy.ts` | 重试策略（EXECUTOR_EXCEPTION→retry, INVALID_INPUT→no_retry）|
| `src/lib/ai/orchestration/fallback-policy.ts` | 兜底链决策 |
| `src/lib/ai/handlers/handler.types.ts` | FeatureHandler 类型（validate/buildRequest/postProcess） |
| `src/lib/ai/handlers/handler-adapters.ts` | 通用适配器（从 service-registry 自动生成 17 handler）|
| `src/lib/ai/registry/register-all.ts` | 17 个服务的 side-effect 注册入口 |
| `src/lib/ai/adapters/executor-registry.ts` | 3 个 executor 注册（带 IdNormalizedExecutor 适配） |

### 2.3 关键调用链

```
worker (BullMQ ai-tasks 队列)
  → markProcessing → policyOrchestrator.execute
  → decideRouting → 主执行器（third-party/comfyui/mock）
  → 失败 → shouldRetry → decideFallback → 下一执行器
  → markCompleted / markFailed / markDeadLetter
```

---

## 3. Phase 5 数据层（部分完成）

### 3.1 已交付

| Commit | 内容 |
|--------|------|
| `23d0bd0` | 4 个 Repository（settings/users/stats/rules）+ 5 路由迁移（dashboard-stats/rules/cloud/users） |
| `a120f63` | `src/lib/ai/registry/workflow-registry.ts`（DB 优先 + TS 兜底 + LRU 缓存）+ migration 009 |
| `a3a1ca8` | `src/db/repositories/api-configs-repository.ts` + admin/api-config 1 处迁移 |

### 3.2 4 个新 Repository（统一模式）

**模式**：class + 单例；`findById / list / upsert / delete`；`withRetry` 包装 + DB 失败静态兜底

| 文件 | 服务于 | 关键方法 |
|------|--------|----------|
| `src/db/repositories/settings-repository.ts` | systemSettings KV | findByKey / findJson<T> / upsert / delete |
| `src/db/repositories/users-repository.ts` | users 表 | findById / findByEmail / list（search/status 过滤）/ adjustPower / touchLastLogin |
| `src/db/repositories/stats-repository.ts` | dashboard 聚合 | dashboard() 返回 { users/works/tasks/power/features } |
| `src/db/repositories/rules-repository.ts` | prompt_rules | list / listEnabled / findById / upsert / delete |
| `src/db/repositories/api-configs-repository.ts` | api_configs（17 字段）| list（Phase 5.3 只暴露 list）|

### 3.3 WorkflowRegistry（Phase 5.2）

- 文件：`src/lib/ai/registry/workflow-registry.ts`
- 入口：`workflowRegistry.getWorkflowConfig(featureId)`
- 优先级：DB features.workflow_id → TS config (`src/config/comfyui-workflows.ts`) 兜底
- 缓存：5 分钟 TTL 内存 LRU；`invalidate(featureId)` 主动失效
- migration `src/db/migrations/009_seed_features_workflow_id.sql`：text2img.workflowId = `9ae6082b-c7f4-433c-9971-7a8f65a3ea65`

### 3.4 消除的直调 db（30+ 处）

- `api/admin/dashboard-stats/route.ts`：13× → `statsRepository.dashboard()`
- `api/admin/rules/route.ts`：4× → `rulesRepository.*`
- `api/settings/cloud/route.ts`：5× → `settingsRepository.findJson/upsert`
- `api/admin/users/route.ts`：8× → `usersRepository.list`
- `api/admin/api-config/route.ts`：1× → `apiConfigsRepository.list`（剩余 7 处未迁）

---

## 4. 下次启动要做的（Phase 5 收尾 + Phase 6 启动）

### 4.1 优先级排序

| # | 任务 | 预估 | 风险 | 备注 |
|---|------|:----:|:----:|------|
| 1 | 补完 admin/api-config 剩余 7 处直调 db | 1d | 🟡 | **坑已记录**（apiKey 字符渲染陷阱） |
| 2 | 散点 14 处直调 db 迁移 | 0.5d | 🟢 | comfyui/execute、prompt-optimize、translate、power/* 等 |
| 3 | ProviderRegistry 完整化（LLM + ComfyUI provider 统一入口） | 1d | 🟢 | 用现有 `providers` 表 + `providerRepository` |
| 4 | FeatureRegistry 完整化（聚合 featureRepository） | 0.5d | 🟢 | 已覆盖大部分 |
| 5 | 结构化 system_settings（拆 KV 表） | 1d | 🟡 | 业务触发时做 |
| 6 | 进 Phase 6：算力账本/模型中心/LoRA/告警/审计 | 5d | 🟡 | 平台能力层 |
| 7 | 进 Phase 7：前端元数据化 | 3-5d | 🟡 | Sidebar/Workspace/表单/上传组件 |

### 4.2 🔴 admin/api-config 剩余 7 处迁移（已知陷阱）

**坑**：sed/Python 替换时 `apiKey: ***` → 工具渲染为 6 个 `*`，破坏语法。

**安全方案**（下次直接用）：
1. 永远用 **byte-level Python 替换**（`raw = f.read(); raw.replace(b'...', b'...')`）
2. **byte 模式**写文件：`open(p, 'wb')`
3. **绝对不要**用 sed 转 `*` 字符
4. **测试时**：每个替换前先 `grep -c "目标字符串"` 确认匹配数，替换后再次 `grep -c` 验证

**剩余 7 处**（在 `src/app/api/admin/api-config/route.ts`）：
- L67: `if (db) { try { ... dbConfigs = await db.select().from(apiConfigs) ... } }` → `if (true) { try { ... dbConfigs = await apiConfigsRepository.list() ... } }`
- L408: `db.select().from(apiConfigs).where(eq(apiConfigs.id, id)).limit(1)` → `apiConfigsRepository.findById(id)`
- L412-429: `db.update(apiConfigs).set({...}).where(eq(...))` 块 → `apiConfigsRepository.upsert({ id, ...updateFields })`（**L412 updateFields 必含 id**）
- L432-449: `db.insert(apiConfigs).values({...})` 块 → `apiConfigsRepository.upsert({ id, ...fields })`（**L432 upsert 第一行必含 id**）
- L453: `db.select().from(apiConfigs).where(eq(apiConfigs.id, id)).limit(1)` → `apiConfigsRepository.findById(id)`
- L467: `db.delete(apiConfigs).where(eq(apiConfigs.id, id))` → `apiConfigsRepository.delete(id)`
- L530: 同 L467

**关键**：
- 修 repository `apiKey?: *** 的地方**直接用 byte replace**
- 修 `apiKey?: input.apiKey` — repository 输入参数 `input.apiKey` 正确（之前误改过）

### 4.3 ProviderRegistry 完整化（**先于** Phase 6）

**目标**：把 LLM provider（minimax/deepseek/hermes/openai/anthropic/qwen/zhipu/自定义）和 ComfyUI provider 统一管理入口。

**已有**：
- `src/lib/ai-gateway/port.ts`（老 AI 网关，标记 deprecated）
- `src/lib/ai-gateway/adapters/comfyui.ts`（ComfyUI adapter）
- `src/lib/ai-gateway/adapters/lora-db.ts`（LoRA adapter）
- `src/db/repositories/provider-repository.ts`（Provider CRUD）
- `src/db/schema/providers.ts`（新 providers 表）

**缺失**：
- 统一 ProviderRegistry 服务（按 provider id 路由到对应 adapter）

---

## 5. 架构权威文档（Single Source of Truth）

| 文件 | 用途 |
|------|------|
| `docs/ARCHITECTURE.md` | **唯一权威架构文档**（技术栈/目录/17 功能/Phase 4-8 演进路线） |
| `docs/ADMIN-FRONTEND-MAPPING-2026-08-13.md` | 后台 10 tab ↔ 前端 17 功能映射 |
| `docs/COMFYUI-WORKFLOW-DEPENDENCIES-2026-08-07.md` | 16 个 ComfyUI 工作流依赖 |
| `docs/PHASE-1-5-PROGRESS-2026-08-13.md` | **本文档** |

**历史文档**（仅作背景参考）：`ARCHITECTURE-V2.md`、`NEW-ARCHITECTURE-VS-CURRENT.md`、`PROJECT-ARCHITECTURE.md` 等。

---

## 6. 环境变量与运行

### 6.1 .env.local（不入 git）

```
DATABASE_URL=postgresql://dunhuang1:***@localhost:5432/dunhuang
JWT_SECRET=<44 chars, 真实值>
MINIMAX_API_KEY=<真实 minimax key>
API_KEY_ENCRYPTION_KEY=<64 hex>
REDIS_URL=redis://localhost:6379
ALLOWED_ORIGIN=http://localhost:5000
NODE_ENV=development
```

### 6.2 启动命令

```bash
# 启动 Docker 5 容器
cd /d/DunHuangGold-Design-AI-main
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 验证
curl -s -L -o /dev/null -w "%{http_code}\n" http://localhost:5000/

# 端到端测试
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@dunhuang.com","password":"admin123"}' | \
  python -c "import sys,json; print(json.loads(sys.stdin.read())['data']['token'])")
curl -s http://localhost:5000/api/models -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:5000/api/admin/dashboard-stats -H "Authorization: Bearer $TOKEN"
```

### 6.3 容器状态查询

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
```

---

## 7. 已知坑（下次避免）

| # | 坑 | 解决 |
|---|----|------|
| 1 | **工具渲染 `apiKey` 为 6 个 `*`** | 用 byte-level Python 替换，绝不用 sed 处理 `*` |
| 2 | **sed 多行替换转义失败** | 用 Python `re.sub` 或 heredoc |
| 3 | **patch 工具 `path required` 错** | 参数顺序 `path` 必须在最后 |
| 4 | **Dockerfile 硬编码 `JWT_SECRET=*** 长度不足** | 用 build-arg + base64 占位 ≥32 字符 |
| 5 | **ComfyUI 不可用时 fetch 挂起** | 加 `AbortSignal.timeout(8000)` |
| 6 | **沙箱内 HTTPS 443 阻断** | 用 SSH 22 端口 + GitHub SSH key |
| 7 | **tsx 不支持 top-level await（CJS 模式）** | 包成 `async function main()` 调 `main()` |
| 8 | **Dockerfile `${RANDOM}` 不解析** | sh 不支持，用固定字符串占位 |
| 9 | **cloud_connections 删错 = dashboard 崩溃** | 删除前 grep "llm-" 确认 |

---

## 8. 验证清单（下次启动后跑）

```bash
# 1. 容器健康
docker ps --format "table {{.Names}}\t{{.Status}}"

# 2. 关键 API
curl -s http://localhost:5000/api/features | head -c 300
curl -s http://localhost:5000/api/feature-costs | head -c 300
TOKEN=$(...)
curl -s http://localhost:5000/api/models -H "Authorization: Bearer $TOKEN" | head -c 300
curl -s http://localhost:5000/api/admin/dashboard-stats -H "Authorization: Bearer $TOKEN" | head -c 300
curl -s "http://localhost:5000/api/admin/api-config?action=list" -H "Authorization: Bearer $TOKEN" | head -c 300

# 3. 17 功能逐个跑（可用 LLM）
curl -X POST http://localhost:5000/api/ai/generate-async \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"featureId":"text2img","params":{"prompt":"test"}}' | head -c 300

# 4. 数据库 migration 已应用
docker logs dunhuang-web | grep -E "009|008|007" | head -5
```

---

## 9. 待办任务（按 ROI 排）

| # | 任务 | 工作量 | ROI |
|---|------|:----:|:---:|
| 1 | 补完 admin/api-config 7 处（用 byte replace） | 0.5d | 🟢 |
| 2 | 散点 14 处直调 db 迁移 | 0.5d | 🟢 |
| 3 | ProviderRegistry 完整化 | 1d | 🟢 |
| 4 | Phase 6 平台能力（算力账本/告警） | 5d | 🟡 |
| 5 | Phase 7 前端元数据化 | 3-5d | 🟡 |

---

## 10. 联系上下文

- 沙箱网络隔离：HTTPS 443 被阻，SSH 22 通
- 用户机器网络正常（能 push git、登录 GitHub 网页）
- **下次推送必须走 SSH**：remote URL 已是 `git@github.com:...`
- SSH key 在沙箱：`~/.ssh/id_ed25519` + `id_ed25519.pub`（已加 ssh-agent）

---

**最后更新**：2026-08-13 16:30
**下次启动步骤**：
1. 读本文档
2. `git log --oneline -5` 确认当前 HEAD
3. 跑 Section 8 验证清单
4. 根据 Section 9 待办选一个建分支开干
