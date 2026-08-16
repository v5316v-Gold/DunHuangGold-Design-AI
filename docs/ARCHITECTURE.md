# 敦煌金 AI 设计平台 · 架构（v1）

> **单一可信源（2026-08-16）**：本文档替换 coze 时代旧 ARCHITECTURE.md / AGENTS.md / DEPLOYMENT.md 中残留的过时描述（"12 → 5 核心 API"、"Coze API 部署"、"coze dev/build"、Supabase、`/app/work/logs/bypass` 等）。
>
> 详细修复历史见 [`PRODUCTION-FIXES-2026-08-15.md`](./PRODUCTION-FIXES-2026-08-15.md)。

---

## 一、技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| 框架 | Next.js（App Router） | 15.2.3 |
| 语言 | TypeScript | 5.x |
| UI | React 19 + Tailwind 4 + shadcn/ui (Radix) | — |
| ORM | Drizzle ORM | 0.45.1 |
| DB | PostgreSQL | 18.4-alpine |
| 队列 | Redis 7 + BullMQ | 6.x |
| AI 编排 | 5 层 Hexagonal（PolicyOrchestrator + 3 个 Executor） | 自研 |
| 部署 | Docker Compose（Next.js standalone + tsup 打包 worker） | — |
| 鉴权 | JWT (jose) + HttpOnly Cookie | — |
| 可观测 | Sentry 8.x + 自建 telemetry（18 字段） | — |

## 二、5 层 Hexagonal 架构

```
┌────────────────────────────────────────────────────────┐
│ L1 · Presentation  Next.js 15 App Router               │
│   ├─ /api    69 routes（含 31 个后台管理端点）         │
│   ├─ /admin  后台 UI：用户/算力/任务/模型/作品/概览…  │
│   └─ /workspace  前台 17 功能面板                       │
├────────────────────────────────────────────────────────┤
│ L2 · Application  src/lib/ai/application/                │
│   ├─ GenerationService 幂等防双扣 + 资源结算           │
│   ├─ PowerLedger  三态 reserve→consume/release（真事务）│
│   └─ Telemetry    18 字段落库 + Sentry 上报            │
├────────────────────────────────────────────────────────┤
│ L3 · Orchestration  src/lib/ai/orchestration/           │
│   ├─ PolicyOrchestrator 主调度（feature→executor 路由）│
│   ├─ buildPlan()  构造冻结 ExecutionPlan（ADR-009）   │
│   ├─ execute(plan?) 传入 plan 跳过重路由（冻结语义）  │
│   ├─ routing-policy / retry-policy / fallback-policy  │
│   └─ executors/  3 个 Executor（ComfyUI / Hermes / MiniMax）│
├────────────────────────────────────────────────────────┤
│ L4 · Adapters  src/lib/ai/adapters/ + orchestrator/executors/│
│   ├─ executor-registry 注册 3 个 Executor 并归一化 id  │
│   └─ IdNormalizedExecutor 修复 -local 后缀 → ExecutorType│
├────────────────────────────────────────────────────────┤
│ L5 · Infrastructure                                     │
│   ├─ PostgreSQL 28+ 表（src/db/schema/）                │
│   ├─ Redis 7-alpine（BullMQ + 幂等 + 缓存）            │
│   └─ ComfyUI 0.18+（本地，可选 GPU 容器）              │
└────────────────────────────────────────────────────────┘
```

**依赖方向**：L1 → L2 → L3 → L4 → L5（单向，绝无反向）

## 三、AI 编排核心（ADR-009 冻结语义）

任务创建时，PolicyOrchestrator 构造 `ExecutionPlan` 快照（包含 executorId / fallbackChain / workflowVersion / models / loras / controlnets）并持久化到 `tasks.execution_plan`（jsonb）。Worker 消费时**读取该 plan 执行**，不再重新 `decideRouting`——保证管理员切换 Active Workflow / `features.default_executor` 时**已创建任务不穿透**。

```sql
ALTER TABLE tasks ADD COLUMN execution_plan jsonb;  -- 迁移 014
```

## 四、执行器（Executor）

| id | type | 能力 |
|---|---|---|
| `comfyui` | comfyui | 16 个设计类功能（text2img/refine/relief/...）|
| `hermes` | hermes | dialogue（AI 对话）|
| `third-party` | third-party | 5 真支持功能（text2img/text2video/...，云 fallback）|

**id 归一化**（W1 + P0 修复）：`IdNormalizedExecutor` 把 `comfyui-local → comfyui`、`mock-local → mock`、`hermes-agent-local → hermes`，与 `routing-policy` 决策的 `ExecutorType` 对齐。修复前本地 ComfyUI/Hermes 永远不会被路由命中。

## 五、算力账本（Power Ledger）

三态原子机（真事务 + 原子 `UPDATE ... SET power = power - $amount WHERE power >= amount`）：

```
reserve(userId, taskId, amount)  →  写 power_reservations(reserved)
                                       （幂等：同 taskId 复用预留）
settle(reservationId, 'consume')  →  事务内：原子扣余额 + 双写日志 + 标记 consumed
settle(reservationId, 'release')  →  标记 released（退还预留，不扣）
```

幂等保障：`onConflictDoUpdate` + `inArray(status, ['reserved','released'])` + balance `>= amount` 守卫 + 事务回滚。

## 六、API Key 落库加密（W1）

主页 `api_configs.api_key` **只存脱敏值**（前缀 `*` + 后 4 位）。真实密文存 `api_config_secrets`（AES-256-GCM，密钥来自 `API_KEY_ENCRYPTION_KEY`）。解密统一过 `src/lib/secret-vault.ts`。

```ts
encryptSecret(plain) → { ciphertext, iv, authTag }  // 写 api_config_secrets
decryptSecret({ ciphertext, iv, authTag }) → plain  // 读时（resolveApiConfig）
```

## 七、17 功能 × 3 执行器

| 功能 | 短 id | 默认执行器 | 算力 |
|---|---|---|---:|
| 文案生图 | text2img | third-party | 15 |
| 产品精修 | refine | comfyui | 20 |
| 多图融合 | blend | comfyui | 15 |
| 一键设计 | oneclick | comfyui | 15 |
| 生成多视图 | multiview | comfyui | 20 |
| 线稿/写实 | sketch | comfyui | 15 |
| 自由创作 | free | comfyui | 15 |
| 图转浮雕 | relief | comfyui | 20 |
| 图转 3D | image3d | comfyui | 30 |
| 平面转立体 | 2dto3d | comfyui | 25 |
| 移除背景 | removebg | comfyui | 5 |
| 高清放大 | upscale | comfyui | 5 |
| 去除水印 | watermark | comfyui | 5 |
| 文生视频 | text2video | third-party | 50 |
| 图生视频 | img2video | third-party | 40 |
| AI 对话 | dialogue | hermes | 2 |
| 佩戴效果 | tryon | comfyui | 25 |

## 八、任务状态机

```
pending → processing → completed
        ↘            ↘ failed → dead_letter
        ↘            ↘ cancelled
processing → processing（worker 重入幂等）
processing → dead_letter（worker 最终失败，已修）
```

非法流转被 `canTransition(from, to)` 拒绝。

## 九、部署（Docker Compose）

```
┌──────────┐  ┌──────────┐  ┌────────────────┐
│ web      │  │ worker   │  │ postgres 18.4  │
│ Next.js  │  │ BullMQ   │  │ (drizzle 表)   │
│ :5000    │  │ (tsup)   │  │                 │
└────┬─────┘  └────┬─────┘  └────────────────┘
     │             │  consume tasks
     └─────────────┴─── Redis 7 (BullMQ + 幂等) ───┐
                                                    │
                            UPLOAD_DIR (web volume) ┘
```

启动：
```bash
cp .env.example .env  # 填入 JWT_SECRET / API_KEY_ENCRYPTION_KEY / MiniMax
docker compose up -d --build
# entrypoint 自动跑 src/db/migrations/*.sql（幂等 IF NOT EXISTS）
```

## 十、核心架构红线（不可破坏）

- 用户请求**只能**带 `featureId + 业务 params`，禁止带 `workflowId / model / lora / provider / executor`
- 所有 AI 任务**必须**走 `GenerationService → PolicyOrchestrator(plan) → Executor Port`
- 任务状态变更**必须**走 `task-state.ts`（不允许 Controller 直写）
- Worker 重试**必须**读 `tasks.execution_plan` 冻结 plan（ADR-009）

## 十一、版本与镜像

| 组件 | 镜像 tag | 包含 |
|---|---|---|
| web | `dunhuang-web:v1.23` | P0#1+#2 + reconcile 修复 + Cookie Secure（生产 HTTPS 才开）+ 限流 |
| worker | `dunhuang-worker:v1.19` | P0#1 plan 读取 + 结算 + heartbeat + executor-registry |

## 十二、已知 P1 遗留（上线后改进项，不阻塞部署）

| 项 | 现状 | 推荐 |
|---|---|---|
| **JWT 撤销** | `logout` 只清客户端 cookie，**JWT 本身仍 7 天有效**——泄露的 token 在过期前可继续使用 | 加 `users.token_version`，JWT payload 含 `ver`，logout 时 `token_version++`，`verifyToken` 校验 `ver === user.token_version`（DB 一致性保证） |
| **Cookie Secure flag** | ✅ P1 已修：login/register/logout 都用 `process.env.NODE_ENV === 'production'` 条件启 Secure | 部署时确认用 HTTPS + 反代（已就绪 `docker-compose.yml` 由 nginx/traefik 终止 TLS） |
| **chat SSE 超时** | 当前 `spawn` 长 LLM 调用无心跳，长对话时 nginx 可能 60s 切连接 | 流式响应加 `:\n\n` 增量 keep-alive（每 15s 一字节） + AbortSignal.timeout 120s |
| **test jsdom 隔离** | `generation-service.test.ts` 在 node 环境采集期挂起（旧 `feature-orchestrator` 删后 import 解析涉及 jsdom 路径） | 给该文件加 `// @vitest-environment jsdom` 指令，或在 `vitest.node.config.ts` 用 `exclude` 排除让它在 jsdom 配置下跑 |
| **reconcile-power `--apply` 幂等** | ✅ 已修：按 `(user_id, reason)` 查重，同源 adjust 行已存在则跳过 |
| **架构文档** | ✅ ARCHITECTURE.md 已与代码一致 | 持续随代码演进 |
