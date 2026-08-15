# 生产级修复记录（2026-08-15）

> 本文档记录从「原型→产品过渡态」到「可交互可用、可部署上线」所应用的关键修复。
> 修复基于对全库 482 个文件（约 85K 行）的专家级审查，按严重级排序落地。

## 一、资金链路（算力账本）—— 最高优先级

| 问题 | 修复 | 文件 |
|---|---|---|
| 算力结算从未接通（用户免费生成） | Worker 完成时 `settlePower('consume')`，失败时 `'release'` | `workers/orchestrator-worker.ts`、`worker/src/index.ts` |
| reserve 不传 taskId → settle 永远查不到 | 先生成 taskId，再带 taskId 预留，显式落库 | `src/lib/ai/application/generation-service.ts` |
| PowerLedger.consume 是「伪事务」（TOCTOU） | 真实 `db.transaction` + 原子 `UPDATE ... WHERE power >= amount` + 幂等认领 | `src/lib/ai/application/power-ledger.ts` |
| 自助充值漏洞（任意用户 add/set） | `/api/power` 的 `add`/`set` 仅管理员，`deduct` 改原子扣减 | `src/app/api/power/route.ts` |
| 任务取消不释放预留 | cancel 时 `settlePower('release')` | `src/lib/ai/application/generation-service.ts` |
| 后台充值并发丢更新 | `adjustUserPower` 事务 + `FOR UPDATE` 行锁 | `src/lib/admin/power-ops.ts` |
| 前端双扣费 | 前端 `deductPower` 只刷新余额，不再 POST | `src/lib/power.ts` |

## 二、任务状态机 / Worker

| 问题 | 修复 | 文件 |
|---|---|---|
| task-state 写不存在的列（updated_at/attempt） | 迁移补列 + drizzle schema 补字段 | `012_*.sql`、`src/db/schema/_tables.ts` |
| 任务卡 processing（processing→dead_letter 被拒） | 状态机白名单补 `dead_letter` | `src/lib/queue/task-state.ts` |
| 长任务被 30s stalled 判定重复执行 | `stalledInterval: 130s, maxStalledCount: 1` | 两个 worker |
| 部署的 worker 未注册执行器 | `worker/src/index.ts` 补 `executor-registry` 导入 | `worker/src/index.ts` |

## 三、数据库迁移

| 问题 | 修复 | 文件 |
|---|---|---|
| `power_reservations`/`providers`/`provider_credentials` 无迁移 | 新增幂等迁移 | `src/db/migrations/012_power_reservations_providers.sql` |

## 四、安全

| 问题 | 修复 | 文件 |
|---|---|---|
| settings/cloud·llm·comfyui 任意用户可读写密钥 | 加 admin 校验 | `src/app/api/settings/*` |
| comfyui/call 路由鉴权被注释 | 恢复 requireAuth | `src/app/api/comfyui/call/route.ts` |
| proxy-image/proxy-model SSRF 可绕过 | 默认拒绝 + DNS 全量解析 + 私网拦截 + 禁重定向 | 两个 proxy 路由 |
| chat 路由 execSync 命令注入 | 改 `spawn` 参数数组（shell:false） | `src/app/api/chat/route.ts` |
| `/api/admin/dashboard-stats` 进公开白名单 | 从 PUBLIC_PATHS 移除 | `src/middleware.ts` |

## 五、前台结果契约（交互可用）

| 问题 | 修复 | 文件 |
|---|---|---|
| 11 个面板把任务对象当图片 URL | `useAiGeneration` 归一化结果对象，面板统一解包 | `src/hooks/useAiGeneration.ts` + 11 面板 |
| 4 个直连面板不轮询 | 改为 taskId 轮询 `/api/tasks/[id]` | Text2Video/Image2Video/ImageWorkspace/Dialog2D3D |
| featureId 双轨命名 | 统一短 id，config/features.ts 与 feature-registry 对齐 | `src/config/features.ts` 等多处 |

## 六、后台管理 API 补全

新增 `/api/admin/*` 端点：users（列表/充值/改角色）、power（汇总/流水/充值）、tasks（列表/详情/重试/取消）、models（登记/上传）、works（审核）、lora、dashboard-stats、api-config、app-settings、rules、ai-assistant-config、clear-cache、comfyui/connections、comfyui/workflows、llm-providers/fetch-models。

## 验证状态

- `tsc --noEmit`：0 错误
- `next build`：成功（exit 0）
- `power-ledger` 单测：7/7 通过（含幂等/重试新语义）
- 其余 node 套件：通过（排除 jsdom/真实 API/e2e 三类，已在 `vitest.node.config.ts` 显式排除）

## 已知仍待办（非阻塞）

- `use-task-polling.test.ts` 需 jsdom 环境（已在 node 配置排除）
- `generation-service.test.ts` 在 node 环境模块采集期挂起（既有问题，与本次改动无关，建议在 jsdom 配置下跑）
- README/ARCHITECTURE 的历史数据（路由数/测试数/里程碑 commit）需校准
- chat/comfyui 路由可再加限流
