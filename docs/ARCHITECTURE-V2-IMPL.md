# 敦煌金 AI 5 层架构重塑 — 实施报告

> **实施时间**：2026-08-03
> **基础**：任务一（docs/AUDIT-REPORT.md）+ 任务二（docs/FEATURES-AUDIT.md）
> **目标**：按 5 层架构大规模重塑项目

---

## 一、执行总览

| Phase | 内容 | 状态 | 关键产出 |
|---|---|---|---|
| **1** | L4 数据层扩展 | ✅ | `audit_logs` + `features` 表 + `works.feature_code` + migrations |
| **2** | L4 资源抽象 | ✅ | `StorageService` 统一 S3/R2/本地 |
| **3** | L3 编排层 | ✅ | `FeatureOrchestrator` + 3 个 Executor |
| **4** | L2 API 管理层 | ✅ | `/api/ai/generate` 走 orchestrator + `/api/admin/features` + API Key 加密 |
| **5** | L1 前端层 | ✅ | Sidebar 用 `useFeatures` 驱动 + admin 入口按角色显示 |
| **6** | L5 执行层 | ✅ | Worker 进程 + docker-compose 拆分 + ComfyUI 适配 |
| **7** | 文档与验证 | ✅ | `docs/ARCHITECTURE-V2.md` + ts-check 0 错误 |

---

## 二、完整文件清单（**23 个文件全部 OK**）

### Phase 1：数据层扩展（4 个）
- ✅ `src/db/schema/_tables.ts`（追加 `works.featureCode` + 新增 `auditLogs` 表）
- ✅ `src/db/schema/features.ts`（新建 - 功能动态配置表）
- ✅ `src/db/schema.ts`（re-export 新 features）
- ✅ `src/db/migrations/007_architecture_v2.sql`（迁移 SQL）

### Phase 2：资源抽象（3 个）
- ✅ `src/lib/storage/storage-service.ts`（接口 + 工厂）
- ✅ `src/lib/storage/local-storage.ts`（本地实现）
- ✅ `src/lib/storage/s3-storage.ts`（S3/R2 实现）

### Phase 3：编排层（5 个）
- ✅ `src/lib/orchestrator/types.ts`（核心类型）
- ✅ `src/lib/orchestrator/executors/mock-executor.ts`（开发 + 测试用）
- ✅ `src/lib/orchestrator/executors/comfyui-executor.ts`（复用 comfyui-call-service）
- ✅ `src/lib/orchestrator/executors/third-party-executor.ts`（智谱/豆包/OpenAI 路由 stub）
- ✅ `src/lib/orchestrator/feature-orchestrator.ts`（**核心：DB+静态 fallback + executor chain + logAudit**）

### Phase 4：API 管理层（5 个）
- ✅ `src/app/api/ai/generate/route.ts`（完全改写 → 走 orchestrator）
- ✅ `src/app/api/features/route.ts`（公开接口 - 返回 enabled 功能）
- ✅ `src/app/api/admin/features/route.ts`（GET/POST/PATCH + admin 校验 + logAudit）
- ✅ `src/lib/audit-logger.ts`（fail-soft 写审计）
- ✅ `src/lib/api-key-crypto.ts`（AES-256-GCM + maskApiKey）

### Phase 5：前端层（2 个）
- ✅ `src/lib/use-features.ts`（`useFeatures` + `useCurrentUser` hooks）
- ✅ `src/components/layout/Sidebar.tsx`（**重大改造**：从 `/api/features` 动态加载菜单 + 角色过滤 admin 入口 + 登录/退出）

### Phase 6：执行层（3 个）
- ✅ `workers/orchestrator-worker.ts`（BullMQ Worker，调 orchestrator）
- ✅ `src/lib/comfyui/executor-integration.ts`（ComfyUI workflow 适配）
- ✅ `docker-compose.yml`（**新增 worker service**，独立资源限制 4 CPU + 4GB）

### Phase 7：文档（1 个）
- ✅ `docs/ARCHITECTURE-V2.md`（5 层架构说明）

---

## 三、5 层架构全景

```
┌─────────────────────────────────────────────────────────────┐
│ L1 前端入口层 (Presentation)                                │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ src/components/layout/Sidebar.tsx                     │ │
│ │   - useFeatures() → 从 /api/features 动态加载菜单   │ │
│ │   - useCurrentUser() → 从 /api/auth/me 拿用户角色   │ │
│ │   - isAdmin 控制"管理后台"入口显示                    │ │
│ │   - 普通用户访问 /admin 被 src/middleware.ts 拦截   │ │
│ └───────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ L2 API 管理层 (API Gateway)                                 │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ /api/ai/generate    → JWT 校验 → orchestrator.execute│ │
│ │ /api/features       → 公开：返回 enabled 列表         │ │
│ │ /api/admin/features → admin only + audit log         │ │
│ │ /api/admin/users    → admin only + audit log         │ │
│ │ src/lib/api-key-crypto.ts → AES-256-GCM 加密 API Key │ │
│ │ src/lib/audit-logger.ts   → 异步写 audit_logs        │ │
│ └───────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ L3 功能编排层 (Orchestrator)                                │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ FeatureOrchestrator.execute(featureId, inputs, userId)│ │
│ │   1. DB 加载 feature 配置 (cost/enabled/executor)    │ │
│ │   2. 检查 enabled=false → 直接拒绝                  │ │
│ │   3. 构建执行器链：[defaultExecutor, ...fallback]   │ │
│ │   4. 按链尝试：MockExecutor / ComfyUIExecutor / 3rd │ │
│ │   5. 失败可重试 → 下一个执行器                       │ │
│ │   6. logAudit 记录成功执行                           │ │
│ └───────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ L4 数据与资产层 (Data & Assets)                            │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ PostgreSQL + Drizzle ORM 0.45                        │ │
│ │   - users (含 role 字段)                             │ │
│ │   - features (动态配置)                              │ │
│ │   - works (含 feature_code)                          │ │
│ │   - tasks (含状态机: pending→running→done/failed)   │ │
│ │   - audit_logs (管理员操作审计)                      │ │
│ │   - api_configs (API Key 加密存储)                   │ │
│ │ Redis 7 + BullMQ 6 (异步队列)                        │ │
│ │ StorageService (S3/R2/本地)                          │ │
│ └───────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ L5 执行与运维层 (Execution & Ops)                           │
│ ┌───────────────────────────────────────────────────────┐ │
│ │ workers/orchestrator-worker.ts                       │ │
│ │   - BullMQ Worker 消费 generation:v2               │ │
│ │   - 调 FeatureOrchestrator.execute()                │ │
│ │                                                       │ │
│ │ ComfyUI 常驻进程                                      │ │
│ │   - POST /prompt 接收 workflow JSON                 │ │
│ │   - LoRA 文件预放 /loras/ 目录                       │ │
│ │   - 动态注入权重                                      │ │
│ │                                                       │ │
│ │ 第三方 API Client                                     │ │
│ │   - 智谱 / 豆包 / OpenAI / Stability                 │ │
│ │   - 独立封装，统一鉴权 + 重试                        │ │
│ │                                                       │ │
│ │ Docker Compose                                       │ │
│ │   - app (Web, 2 CPU + 2GB)                          │ │
│ │   - worker (异步队列, 4 CPU + 4GB)                  │ │
│ │   - redis (队列/缓存)                                │ │
│ │   - postgres (数据)                                  │ │
│ │   - nginx (反代)                                     │ │
│ └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 四、关键代码亮点

### 4.1 L1 Sidebar 从配置驱动（最关键的改造）

**改造前**（硬编码 56 行 menuGroups 常量）：
```tsx
const menuGroups = [
  { title: '浮雕圆雕', items: [
    { id: 'relief', label: '图转浮雕图', labelEn: 'IMAGE TO RELIEF', icon: Mountain },
    // ... 17 项全部硬编码
  ]},
  // ...
];
```

**改造后**（从 `/api/features` 动态加载 + 按角色过滤）：
```tsx
const { features: featureList } = useFeatures();
const currentUser = useCurrentUser();
const isAdmin = currentUser?.role === 'admin';

const menuGroups = buildMenuGroups(featureList);  // 17 项从 DB 读取

// 底部入口：admin 才能看到"管理后台"
{isAdmin && (
  <button onClick={() => window.location.assign('/admin')}>
    <Shield /> 管理后台
  </button>
)}
```

### 4.2 L3 Orchestrator 核心逻辑（fallback chain）

```ts
// src/lib/orchestrator/feature-orchestrator.ts
async execute(req: FeatureExecutionRequest): Promise<FeatureExecutionResult> {
  // 1. DB 加载功能配置（不允许前端伪造 cost/executor）
  const feature = await this.loadFeatureConfig(req.featureId);
  if (!feature?.enabled) return this.fail(req, 'FEATURE_DISABLED', ...);

  // 2. 构建执行器链：[defaultExecutor, ...fallbackExecutors]
  const chain: ExecutorType[] = [
    feature.defaultExecutor,
    ...(feature.fallbackExecutors || []),
  ];

  // 3. 按链尝试
  for (const execType of chain) {
    const exec = this.executors.get(execType);
    if (!exec?.capabilities().has(req.featureId)) continue;

    try {
      const result = await exec.execute({ ...req, _feature: feature });
      if (result.success) {
        await logAudit({ action: 'feature.execute', ... });
        return result;
      }
      if (!result.error?.retryable) return result;  // 不可重试直接返回
    } catch (err) {
      // 继续 fallback
    }
  }
  return this.fail(req, 'ALL_EXECUTORS_FAILED', ...);
}
```

### 4.3 L2 API Key 加密（AES-256-GCM）

```ts
// src/lib/api-key-crypto.ts
export function encryptApiKey(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function maskApiKey(plain: string): string {
  return plain.slice(0, 4) + '****' + plain.slice(-4);  // 前端只拿脱敏
}
```

### 4.4 L4 audit_logs 表

```sql
-- src/db/migrations/007_architecture_v2.sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email VARCHAR(255),
  actor_role VARCHAR(20),
  action VARCHAR(50) NOT NULL,         -- feature.execute | feature.toggle | ...
  resource_type VARCHAR(50) NOT NULL,  -- feature | user | api-config
  resource_id VARCHAR(100),
  details JSONB DEFAULT '{}',          -- 旧值 → 新值
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX audit_actor_idx ON audit_logs(actor_id, created_at DESC);
CREATE INDEX audit_resource_idx ON audit_logs(resource_type, resource_id);
CREATE INDEX audit_action_idx ON audit_logs(action);
```

### 4.5 L5 Worker + Docker 拆分

```yaml
# docker-compose.yml 新增 worker service
worker:
  image: dunhuang-ai:latest
  restart: unless-stopped
  command: ["node", "workers/dist/orchestrator-worker.js"]
  depends_on:
    postgres: { condition: service_healthy }
    redis: { condition: service_healthy }
  deploy:
    resources:
      limits: { cpus: "4.0", memory: 4096M }  # Worker 吃 GPU/IO
```

```ts
// workers/orchestrator-worker.ts
const worker = new Worker('generation:v2', async (job) => {
  return await orchestrator.execute({
    featureId: job.data.featureId,
    userId: job.data.userId,
    inputs: job.data.inputs,
    traceId: job.id || crypto.randomUUID(),
  });
}, { connection: redisConnection, concurrency: 4 });
```

---

## 五、验证结果

### ✅ TypeScript 类型检查

```bash
$ NODE_ENV=development ./node_modules/.bin/tsc --noEmit
```
**结果**：✅ **0 错误**

### 关键改动统计
- **修改文件**：7 个（含 `_tables.ts`、`/api/ai/generate/route.ts`、`Sidebar.tsx`、`docker-compose.yml`）
- **新建文件**：16 个（数据层 4 + 资源层 3 + 编排层 5 + API 层 5 + 前端层 1 + 执行层 3 + 文档 1）

---

## 六、安全设计亮点（防御性思维）

| 风险点 | 防御措施 |
|---|---|
| 前端伪造 cost | Orchestrator 从 DB 读 cost，不信任前端 |
| API Key 泄漏 | AES-256-GCM 加密 + 前端只拿 `maskApiKey()` |
| 普通用户访问 /admin | `src/middleware.ts` fail-closed 校验 role |
| 管理员操作无审计 | 任何 admin API 调 `logAudit()` |
| JWT_SECRET 缺失 | middleware + auth.ts 双重 fail-fast |
| Worker 进程资源失控 | Docker `deploy.resources.limits` 隔离 |
| ComfyUI 被直连 | Browser 永不直连，必须经服务端代理 |

---

## 七、未做事项（待后续 PR）

1. **`apiConfigs.apiKey` 明文迁移**：现有 DB 中 API Key 是明文，需要回填脚本（用 `encryptApiKey()` 重加密）
2. **Worker Dockerfile 单独编译**：Compose 命令假设 `workers/dist/orchestrator-worker.js` 已就绪，需补充 `scripts/build-workers.sh`
3. **真实第三方 API Client**：当前 ThirdPartyExecutor 是 stub + TODO，需要按 Provider 实现
4. **Worker SSE 进度推送**：BullMQ → Redis pub/sub → EventSource 链路未完整接通
5. **WorkspacePanel 接入 useFeatures**：当前 panelComponents 仍是 17 项 hardcoded lazy import（dynamic import 需要静态路径，理想情况应做 registry）

---

## 八、验收清单

- [x] `pnpm ts-check` 0 错误（已实测）
- [x] Sidebar 不再硬编码菜单
- [x] Sidebar 按角色显示"管理后台"入口
- [x] 普通用户访问 `/admin` 被 middleware 拦截（已有 middleware.ts）
- [x] `/api/ai/generate` 走 orchestrator
- [x] 17 个功能 ID 在 orchestrator + DB + UI 三处一致
- [x] API Key 加密（AES-256-GCM）已实现
- [x] audit_logs 表写入
- [x] audit_logs 表的 migrations SQL 已生成
- [x] Worker 独立进程 + Docker 拆分

---

## 九、5 层一句话落地版（你的原话）

```
前端只管展示和提交
  → Sidebar 从 useFeatures 动态加载，admin 才看到管理入口
后端统一入口加权限
  → 所有请求进 /api/*，JWT + role 双重校验
编排层决定怎么跑
  → FeatureOrchestrator 按 [defaultExecutor, ...fallback] 链执行
数据层存任务和作品
  → features 表管配置，tasks 表管状态，works 带 feature_code，audit_logs 管审计
执行层实际调用 ComfyUI 或第三方 API
  → Worker 进程消费 BullMQ，调 ComfyUI Executor 或 ThirdParty Executor
```

---

## 十、推荐后续 PR

按 ROI 排序：

1. **PR-1**：完整 `pnpm build` 验证（30min）
2. **PR-2**：API Key 明文 → 加密回填脚本（30min）
3. **PR-3**：Worker Dockerfile + 编译脚本（1h）
4. **PR-4**：ThirdParty Executor 真实 API 实现（按 Provider 拆分）
5. **PR-5**：WorkspacePanel 接入 useFeatures（registry 模式）
6. **PR-6**：清掉 362 条 ESLint 警告（4-8h）