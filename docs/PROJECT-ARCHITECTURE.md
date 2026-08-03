# 敦煌金 AI 设计平台 · 整体架构梳理

> 版本：v2.0（2026-08-03）
> 基础：AUDIT-REPORT.md + FEATURES-AUDIT.md + ARCHITECTURE-V2-IMPL.md
> 适用代码库：`F:\Programs\Hermes Studio\home\user\default\project\DunHuangGold-Design-AI`

---

## 一、项目定位

敦煌金 AI 设计平台是一个**集成多 AI 设计工具的在线工作台**，核心卖点是"传承敦煌美学，赋能现代设计"。

| 维度 | 内容 |
|---|---|
| 产品形态 | B2C 在线设计工作台（Web） |
| 核心功能 | 17 个 AI 功能（文生图/3D 建模/浮雕/视频/对话） |
| 视觉主题 | 敦煌金 #C8A45C，深色背景（95% 场景） |
| 用户角色 | user（普通用户）/ admin（管理员） |
| 商业模式 | 算力（power）充值消耗制 |

---

## 二、技术栈全景

### 前端
| 技术 | 版本 | 用途 |
|---|---|---|
| Next.js | 15.1.0 | App Router 框架（src/app 目录） |
| React | 19.2.3 | UI 框架 |
| TypeScript | 5.9.3 | 类型系统 |
| Tailwind CSS | 4.2.4 | CSS-first 样式 |
| shadcn/ui | New York | 组件库（22 个基础组件） |
| Radix UI | 27 个包 | 无头组件原语 |
| lucide-react | 0.468 | 图标 |
| next-themes | 0.4.6 | 主题切换 |
| sonner | 2.0.7 | 通知 |
| @google/model-viewer | 4.2 | 3D 模型预览 |

### 后端 / 数据
| 技术 | 版本 | 用途 |
|---|---|---|
| PostgreSQL | 15 | 主数据库 |
| Drizzle ORM | 0.45.2 | ORM（node-postgres 驱动） |
| drizzle-zod | 0.8.3 | schema → zod 校验 |
| Redis | 7 | 缓存/队列/限流 |
| BullMQ | 6.0.2 | 异步任务队列 |
| ioredis | 5.10.1 | Redis 客户端 |
| jose | 6.2.2 | JWT（替代 jsonwebtoken） |
| bcryptjs | 3.0.3 | 密码哈希 |
| @aws-sdk/client-s3 | 3.1037 | 对象存储（S3/R2） |

### 工程化
| 技术 | 用途 |
|---|---|
| pnpm 9.0.0 | 包管理（only-allow 强制） |
| Vitest 2.1.9 | 单元测试（12 个测试文件） |
| ESLint 9 + Airbnb | 代码规范 |
| Docker + docker-compose | 部署（app/worker/db/redis/nginx） |
| 自定义 scripts/build.sh | 构建入口 |

---

## 三、五层架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│ L1 前端入口层 (Presentation)                                     │
│   src/app/                   路由页面（首页/登录/作品/个人中心） │
│   src/app/admin/             管理后台（数据概览/用户/功能/算力） │
│   src/components/            组件（layout/workspace/admin/ui）  │
│   src/lib/use-features.ts    配置驱动 hooks（useFeatures）       │
│   src/middleware.ts          ⚡ 边缘鉴权（JWT + role）           │
├─────────────────────────────────────────────────────────────────┤
│ L2 API 管理层 (API Gateway)                                      │
│   src/app/api/*              78 个路由（全部走 /api）            │
│   src/lib/auth.ts            JWT 签发/验证/当前用户              │
│   src/lib/api-key-crypto.ts  AES-256-GCM 加密 API Key           │
│   src/lib/audit-logger.ts    审计日志（admin 操作留痕）          │
│   src/lib/api-response.ts    统一返回结构 { success, data... }  │
├─────────────────────────────────────────────────────────────────┤
│ L3 功能编排层 (Orchestrator)                                     │
│   src/lib/orchestrator/       FeatureOrchestrator（核心编排器）  │
│     ├── types.ts              执行器契约（Executor 接口）        │
│     ├── feature-orchestrator 按 fallback 链执行                  │
│     └── executors/            mock / comfyui / third-party      │
│   src/lib/ai-service/         旧服务注册（逐步迁移中）           │
├─────────────────────────────────────────────────────────────────┤
│ L4 数据与资产层 (Data & Assets)                                  │
│   src/db/schema/_tables.ts   13 张表（users/works/tasks/...）    │
│   src/db/schema/features.ts  功能动态配置表（新建）              │
│   src/db/schema/audit-table  审计日志表（新建）                  │
│   src/lib/storage/           StorageService（S3/R2/本地抽象）    │
│   src/lib/queue/             BullMQ 队列（task-queue/task-state）│
│   src/lib/redis.ts           Redis 单例                          │
├─────────────────────────────────────────────────────────────────┤
│ L5 执行与运维层 (Execution & Ops)                                 │
│   workers/orchestrator-worker.ts 独立 Worker 进程（BullMQ）      │
│   src/lib/comfyui/           ComfyUI 集成（executor-integration）│
│   docker-compose.yml         app / worker / db / redis / nginx   │
│   deploy/ + deploy-kit/      部署脚本 + nginx 配置               │
└─────────────────────────────────────────────────────────────────┘
```

**一句话落地版**：前端只管展示和提交，后端统一入口加权限，编排层决定怎么跑，数据层存任务和作品，执行层实际调用 ComfyUI 或第三方 API。

---

## 四、数据库模型（13+ 张表）

### 核心业务表

| 表名 | 关键字段 | 说明 |
|---|---|---|
| **users** | id, email, passwordHash, nickname, avatar, **role**, status, power | 用户（role: user/admin） |
| **works** | id, userId, **featureCode**, type, prompt, inputImageUrl, outputImageUrl, params, powerCost, status | 作品（含 feature_code 分类） |
| **tasks** | id, userId, type, status, input, output, error, progress, powerCost | 异步任务（pending→running→done/failed） |
| **powerLogs** | userId, type, amount, balance, reason | 算力变动日志 |
| **powerTransactions** | userId, type, amount, balanceBefore/After, operatorId, relatedId | 算力流水（只增不改） |
| **favorites** | userId, workId | 收藏 |

### 配置/管理表

| 表名 | 关键字段 | 说明 |
|---|---|---|
| **features**（新） | id, name, category, cost, enabled, defaultExecutor, fallbackExecutors, workflowId, loras, defaultModel, defaultParams, sortOrder, displayGroup | 功能动态配置 |
| **apiConfigs** | id, name, provider, model, apiKey, enabled, paramMapping, responseMapping | API 配置（apiKey 加密存储） |
| **workflows** | id, name, workflowJson, comfyuiHost, enabled | ComfyUI 工作流 |
| **comfyuiConnections** | id, name, host, port, authToken, enabled | ComfyUI 连接 |
| **comfyuiConfigs** | featureId, workflowId, nodeMapping, defaultParams, connectionId | 功能→工作流映射 |
| **systemSettings** | key, value(jsonb) | KV 设置（feature-costs 等） |
| **appSettings** | translateSettings, featureSwitches, selectedServices | 应用级设置 |
| **auditLogs**（新） | actorId, actorEmail, actorRole, action, resourceType, resourceId, details, ipAddress | 管理操作审计 |
| **promptRules** / **translateSettings** / **healthCheck** | — | 辅助表 |

### 关键设计决策
- `works.featureCode`：标准化功能标识，方便按功能分类查询
- `powerTransactions` 只增不改：金额安全（防篡改，用冲账）
- `auditLogs` 3 个索引：actor/resource/action 快速检索
- 软删除字段（deletedAt）与审计字段（createdBy/updatedBy）混入方案已规划

---

## 五、API 路由体系（78+ 个）

### 按前缀分组

| 前缀 | 数量 | 职责 |
|---|---|---|
| `/api/auth/*` | 4 | 登录/注册/登出/当前用户 |
| `/api/ai/*` | 2 | **统一生成入口**（generate / generate-async） |
| `/api/admin/*` | 28 | 管理（用户/算力/功能/API 配置/ComfyUI） |
| `/api/comfyui/*` | 7 | ComfyUI 直连（call/execute/progress/prompt/status） |
| `/api/works/*` | 2+ | 作品 CRUD |
| `/api/<feature>/*` | 16 | 各功能专属路由（relief/stereo/image-3d/...） |
| 其它 | ~19 | upload/download/stats/translate/proxy/... |

### 核心入口：`POST /api/ai/generate`

```
请求: { service: 'text2img'|'relief'|..., prompt?, image?, count?, ... }
流程:
  1. requireAuth(request)          → JWT 校验（401 拦截）
  2. rateLimit(ip, WRITE_LIMIT)    → 限流（429）
  3. isValidServiceType(service)   → 参数校验（400）
  4. pipeline.execute(service, ...) → 旧路径 / orchestrator（新路径）
  5. 统一返回 { success, data, provider, workflow, powerCost, ... }
```

### 统一返回结构（L2 约定）

```json
{ "success": true, "data": {...}, "meta": {...} }
{ "success": false, "error": "权限不足", "code": "FORBIDDEN" }
```

---

## 六、17 个 AI 功能清单

| 功能 ID | 名称 | 类别 | 算力 | 前端组件 | 专属 API |
|---|---|---|---|---|---|
| text2img | 文案生图 | image | 15 | Text2Image | /api/generate-image |
| refine | 产品精修 | image | 20 | ProductRefine | /api/product-refine |
| blend | 多图融合 | image | 15 | MultiImage | /api/multi-image |
| oneclick | 一键设计 | image | 15 | OneClickDesign | /api/one-click-design |
| multiview | 生成多视图 | image | 20 | MultiView | /api/multi-view |
| sketch | 线稿/写实 | image | 15 | SketchRealistic | /api/sketch-realistic |
| free | 自由创作区 | image | 15 | FreeCreation | /api/free-creation |
| removebg | 移除背景 | image | 5 | RemoveBackground | /api/remove-background |
| upscale | 高清放大 | image | 5 | Upscale | /api/upscale |
| watermark | 去除水印 | image | 5 | RemoveWatermark | /api/remove-watermark |
| **tryon** | 佩戴效果 | image | 25 | TryOnEffect | **/api/tryon**（新补） |
| relief | 图转浮雕 | 3d | 20 | ReliefDesign | /api/relief |
| image3d | 图转3D模型 | 3d | 30 | Image3D | /api/image-3d |
| 2dto3d | 平面转雕塑 | 3d | 25 | Dialog2D3D | /api/stereo |
| text2video | 文生视频 | video | 50 | Text2Video | /api/video |
| img2video | 图生视频 | video | 40 | Image2Video | /api/video |
| dialogue | AI 对话 | chat | 2 | AIDialog | /api/chat + /api/ai-assistant |

---

## 七、关键架构决策与设计模式

### 1. AI 网关端口-适配器模式（L3 核心）
```ts
// port.ts — 领域契约
interface AIProviderPort {
  id: string;
  capabilities(): Set<AICapability>;
  health(): Promise<Health>;
  estimate(req): Promise<Cost>;
  generate(req, ctx): Promise<AIResult>;  // ctx: { signal, onProgress }
}
```
- 业务层只依赖 `port.ts`，不直接 import 厂商 SDK
- 适配器（openai/zhipu/doubao/comfyui）做协议转换 + 错误归一化
- 策略路由：功能/成本/延迟/健康度评分（0.40 health + 0.25 quality + 0.20 cost + 0.15 latency）
- fallback 链：`[defaultExecutor, ...fallbackExecutors]`，单请求每 Provider 最多一次

### 2. FeatureOrchestrator（新增，统一编排）
```
execute(featureId, inputs, userId):
  1. DB 加载 features 配置（防前端伪造 cost/executor）
  2. enabled=false → 拒绝
  3. 执行器链 = [default, ...fallback]
  4. 逐个尝试，可重试错误 → 下一个
  5. logAudit 记录
```

### 3. 异步任务 + SSE 进度
- BullMQ 队列 `generation:v2`，独立 Worker 进程
- 进度三路推送：job.updateProgress + Redis pub/sub + DB 持久化（节流）
- 指数退避重试（4 次）+ 死信队列（7 天）
- 前端 `useGenerationTaskManager` 通过事件订阅

### 4. 鉴权体系（L2 安全）
- JWT 双 Token 方案（access 10m + refresh 30d，jose 签发）
- **middleware.ts**：边缘运行时校验，`/admin/*` 强制 role=admin，fail-closed
- API Key 存储：AES-256-GCM 加密（`api-key-crypto.ts`），前端只拿 mask 后值
- 登录限流：IP + 账号双维度（Redis 滑动窗口）
- 审计：任何 admin 写操作 → `audit_logs`

### 5. 存储抽象（L4）
```ts
interface StorageService {
  upload(buffer, key, opts): Promise<UploadResult>;
  delete(key): Promise<void>;
  getSignedUrl(key, expiresIn?): Promise<string>;
  exists(key): Promise<boolean>;
}
// 工厂按 env 选择：S3 / R2 / 本地（开发）
```

---

## 八、前端页面路由

| 路由 | 页面 | 访问权限 | 说明 |
|---|---|---|---|
| `/` | 设计工坊（首页） | 登录用户 | Sidebar + WorkspacePanel（17 功能） |
| `/login` | 登录/注册 | 公开 | 敦煌九层楼 SVG 背景 |
| `/gallery` | 作品展示 | 登录用户 | 作品瀑布流 + 筛选 |
| `/profile` | 个人中心 | 登录用户 | 算力/历史/设置 |
| `/admin` | 管理后台 | **admin only** | 数据概览/用户/功能/算力/API |
| `/admin/features` | 功能管理 | **admin only** | 功能开关 + 算力编辑 |
| `/admin/lora` | LoRA 管理 | **admin only** | LoRA CRUD |
| 任意未知 | 404 | 公开 | 敦煌风 404（not-found.tsx） |

---

## 九、部署拓扑（Docker Compose）

```yaml
services:
  app:      # Next.js Web（2 CPU / 2GB）
  worker:   # BullMQ Worker（4 CPU / 4GB）★ 新增
  postgres: # 主数据库（15-alpine）
  redis:    # 队列/缓存（7-alpine, appendonly）
  nginx:    # 反代（Brotli+gzip+SSE 300s）
```

### 构建链路
```
pnpm build
  └─ scripts/build.sh
      └─ ./node_modules/.bin/next build   # 已修复自递归 bug
```

### 环境变量（关键）
```
DATABASE_URL         # PostgreSQL 连接串
REDIS_URL            # Redis 连接串
JWT_SECRET           # ≥32 字符随机密钥（缺失则 fail-fast）
API_KEY_ENCRYPTION_KEY # AES-256-GCM 加密密钥（32 字节 hex）
NEXT_PUBLIC_APP_URL  # 应用地址
```

---

## 十、当前改造状态（2026-08-03）

### ✅ 已完成
| 项目 | 状态 |
|---|---|
| 5 层架构骨架（orchestrator/storage/audit/features 表） | ✅ 落地 |
| tryon 功能闭环（features 配置 + API 路由 + 别名） | ✅ 补齐 |
| admin 路由保护（middleware.ts + role 校验） | ✅ |
| 功能管理页面（/admin/features） | ✅ |
| build.sh 自递归修复 | ✅ |
| .babelrc 移除（恢复 SWC 编译） | ✅ 构建相关 |
| valkey-glide 可选依赖处理（webpack externals） | ✅ |
| ModelViewerScript 客户端注入（替代 <Script>） | ✅ |
| sonner/useAuth SSR 安全守卫 | ✅ |
| 页面级 server layout（force-dynamic 修复预渲染崩溃） | ✅ |

### 🔧 构建修复进行中（任务一）
- 剩余：`/404`、`/500` 内置错误页预渲染的 `<Html>` bug（Next 15.1.0 + React 19.2.3 兼容问题）

### ⏳ 待推进（任务二~七）
| 任务 | 状态 |
|---|---|
| Prettier 格式修复（Sidebar 缩进等） | ⏳ |
| ESLint 警告分类统计 | ⏳ |
| API Key 明文回填加密脚本（dry-run/备份/报告） | ⏳ |
| Worker Dockerfile + build-workers 脚本 | ⏳ |
| WorkspacePanel 接入 useFeatures（registry 化） | ⏳ |
| 17 功能 vs 14 feature_id 差异核对 | ⏳ |
| 真实 Third-Party Executor（样板 1 个） | ⏳ 暂缓 |

---

## 十一、已知风险与遗留

| 风险 | 说明 | 建议 |
|---|---|---|
| Next 15.1 + React 19.2 兼容 | 内置错误页预渲染崩溃 | 升级 Next ≥15.2 或降级 React 19.1（需用户拍板） |
| 362 条 ESLint 警告 | 184 any + 167 unused | ts-prune/knip 清理 + 渐进收紧 |
| 2 个 vitest suite fail | ai-gateway 缺 jsdom / storage-helper mock | vitest 配置 + mock 修复 |
| API Key 明文存量 | 已加密新写入，存量未回填 | 回填脚本（任务三） |
| 双 ID 体系 | 前端短 ID vs features kebab-case | 统一 FeatureId 类型（任务六） |
| e2e 测试空转 | 12 个测试整文件 skip | 接 Playwright 或删除 |

---

*文档维护：随项目演进持续更新。最新实施细节见 `docs/ARCHITECTURE-V2-IMPL.md`。*
