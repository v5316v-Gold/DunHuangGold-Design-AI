# 📚 25 个 Skill 完整学习卡 — 敦煌金 AI 设计平台

> **生成时间**：2026-07-28  
> **学习方式**：全量 SKILL.md 静态扫描 + 元数据提取 + 要点结构化  
> **覆盖**：25 个 skill / 227 个 workflow 步骤 / 143 条 pitfalls / 164 条 verification  

## 📊 速查总表

| # | Skill | 分类 | 难度 | 价值 | 周期 | Workflow | Pitfalls | Verify |
|---|-------|------|:---:|:---:|:---:|:---:|:---:|:---:|
| **A1** | [Next.js 15 App Router Patterns](frontend/nextjs-app-router-patterns/SKILL.md) | frontend | ⭐⭐ | ⭐⭐⭐⭐⭐ | 1周 | 7 | 0 | 0 |
| **A2** | [React 19 Patterns (Server Actions + Optimistic UI)](frontend/react-19-server-actions/SKILL.md) | frontend | ⭐⭐ | ⭐⭐⭐⭐ | 3天 | 0 | 5 | 8 |
| **A3** | [Tailwind 4 + shadcn/ui Design System](frontend/tailwind4-design-system/SKILL.md) | frontend | ⭐⭐ | ⭐⭐⭐⭐⭐ | 1周 | 7 | 5 | 7 |
| **A4** | [Core Web Vitals Audit (Next.js 15)](frontend/nextjs-core-web-vitals-audit/SKILL.md) | frontend | ⭐⭐⭐ | ⭐⭐⭐⭐ | 1周 | 4 | 8 | 0 |
| **B1** | [PostgreSQL Performance Tuning](backend/postgres-performance-tuning/SKILL.md) | backend | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 2周 | 3 | 6 | 7 |
| **B2** | [Drizzle ORM Patterns](backend/drizzle-orm-patterns/SKILL.md) | backend | ⭐⭐ | ⭐⭐⭐⭐ | 1周 | 8 | 6 | 8 |
| **B3** | [JWT + RBAC Best Practices](backend/jwt-rbac-best-practices/SKILL.md) | backend | ⭐⭐ | ⭐⭐⭐⭐ | 3天 | 7 | 8 | 8 |
| **B4** | [RESTful API Design Conventions](backend/api-design-rest-conventions/SKILL.md) | backend | ⭐⭐ | ⭐⭐⭐⭐ | 1周 | 4 | 7 | 8 |
| **B5** | [Redis Caching Strategies](backend/redis-caching-strategies/SKILL.md) | backend | ⭐⭐ | ⭐⭐⭐ | 3天 | 8 | 6 | 7 |
| **C1** | [AI Gateway — Multi-Provider](ai-gateway/ai-gateway-multi-provider/SKILL.md) | ai-gateway | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 2周 | 8 | 6 | 8 |
| **C2** | [AI Prompt Engineering (敦煌主题中文)](ai-gateway/ai-prompt-engineering-zh/SKILL.md) | ai-gateway | ⭐⭐ | ⭐⭐⭐⭐ | 1周 | 8 | 6 | 5 |
| **C3** | [AI Streaming SSE Patterns](ai-gateway/ai-streaming-sse-patterns/SKILL.md) | ai-gateway | ⭐⭐ | ⭐⭐⭐⭐ | 3天 | 7 | 6 | 7 |
| **C4** | [AI Cost / Power Metering](ai-gateway/ai-cost-power-metering/SKILL.md) | ai-gateway | ⭐⭐⭐ | ⭐⭐⭐⭐ | 1周 | 10 | 6 | 8 |
| **D1** | [Observability Three Pillars](architecture/observability-three-pillars/SKILL.md) | architecture | ⭐⭐⭐ | ⭐⭐⭐⭐ | 1周 | 10 | 6 | 7 |
| **D2** | [Monolith → Microservices](architecture/monolith-to-microservices/SKILL.md) | architecture | ⭐⭐⭐⭐ | ⭐⭐⭐ | 2周 | 10 | 0 | 0 |
| **D3** | [Domain-Driven Design — Bounded Context](architecture/domain-driven-design-bounded-context/SKILL.md) | architecture | ⭐⭐⭐⭐ | ⭐⭐⭐ | 1周 | 11 | 6 | 7 |
| **D4** | [Sentry Error Tracking](architecture/error-tracking-sentry-setup/SKILL.md) | architecture | ⭐⭐ | ⭐⭐⭐ | 2天 | 14 | 6 | 7 |
| **E1** | [Docker Multi-stage Best Practices](devops/docker-multistage-best-practices/SKILL.md) | devops | ⭐⭐ | ⭐⭐⭐⭐⭐ | 3天 | 12 | 7 | 8 |
| **E2** | [Nginx Reverse Proxy Hardening](devops/nginx-reverse-proxy-hardening/SKILL.md) | devops | ⭐⭐ | ⭐⭐⭐⭐ | 3天 | 13 | 7 | 8 |
| **E3** | [1Panel Deployment Guide](devops/1panel-deployment-guide/SKILL.md) | devops | ⭐ | ⭐⭐⭐⭐ | 2天 | 16 | 6 | 8 |
| **E4** | [CI/CD GitHub Actions — Zero Downtime](devops/cicd-github-actions-zero-downtime/SKILL.md) | devops | ⭐⭐⭐ | ⭐⭐⭐⭐ | 1周 | 10 | 6 | 8 |
| **E5** | [SSL/HTTPS Let's Encrypt Auto-renew](devops/ssl-https-letsencrypt-auto-renew/SKILL.md) | devops | ⭐ | ⭐⭐⭐⭐ | 1天 | 13 | 6 | 8 |
| **F1** | [Web3D Three.js Patterns](frontend/web3d-threejs-patterns/SKILL.md) | frontend | ⭐⭐⭐⭐ | ⭐⭐⭐ | 2周 | 10 | 6 | 7 |
| **F2** | [PWA Offline Experience](frontend/pwa-offline-experience/SKILL.md) | frontend | ⭐⭐⭐ | ⭐⭐ | 1周 | 9 | 6 | 7 |
| **F3** | [i18n with next-intl](frontend/i18n-next-intl-setup/SKILL.md) | frontend | ⭐⭐ | ⭐⭐⭐ | 3天 | 18 | 6 | 8 |

---

## 📖 详细学习卡


### 🟢 A. 前端工程


#### A1 — Next.js 15 App Router Patterns

- **路径**：`frontend/nextjs-app-router-patterns/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐⭐⭐ | **学习周期**：1周

**📌 适用场景**：
- 新建 / 重构一个页面（`app/**/page.tsx`）
- 选择 **Server Action** 还是 **Route Handler**
- 配置 `fetch` 缓存、`revalidate`、`unstable_cache`、`revalidatePath/Tag`
- 写 `middleware.ts` 做鉴权 / 重定向 / Header 注入
- 设计 **Parallel Routes**（`@slot`）或 **Intercepting Routes**（`(.) (..) (...)`）

**🚫 不适用**：
- 仅做纯组件样式（用 `tailwind4-design-system`）
- 仅做后端数据库调优（用 `postgres-performance-tuning`）
- 仅做部署（用 `docker-multistage-best-practices` / `1panel-deployment-guide`）
- 跨工具通用提示词工程（不要在本 skill 中写 AI prompt 模板）

**🔧 Workflow 步骤**（7 步）：
1. 决定架构边界
2. 决定数据获取模式
3. 决定 mutation 入口
4. 选择路由模式
5. 加错误边界
6. 评估性能与缓存
7. 安全复核（每次必做）


#### A2 — React 19 Patterns (Server Actions + Optimistic UI)

- **路径**：`frontend/react-19-server-actions/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：3天

**📌 适用场景**：
- 表单提交 + 立即反馈（AI 生成、点赞、关注、评论）
- 优化 UI（用户操作后立即看到结果，不等服务端）
- 表单状态管理（错误、loading、redirect）
- 在 Server Component 中读取 Promise / Context
- 重构旧 `useFormState` 代码

**🚫 不适用**：
- 纯展示组件（无需 state）
- 仅样式调整
- 后端逻辑（用 `jwt-rbac` / `postgres-tuning` 等）
- 

**⚠️ 避坑指南**（5 条）：
- 继续用 `useFormState`（已被 `useActionState` 取代）
- 在 try/catch 内调用 `redirect()`（会被吞）
- `useOptimistic` 不用 `useTransition` 包裹
- 在 Client Component 内调用敏感操作（必须在 Server Action）
- `useOptimistic` 误传 action 函数（应传 state 更新函数）

**✅ 验收清单**（8 条）：
- [ ] 表单提交有 loading 反馈（useFormStatus）
- [ ] 错误显示在对应字段下
- [ ] 点赞 / 关注立即反馈
- [ ] 重复点击 AI 生成只扣一次算力
- [ ] 跳转后数据已刷新
- [ ] ref 不需要 forwardRef
- [ ] Server Action 全部用 `'use server'` 指令
- [ ] 所有 Action 重新鉴权 + 校验资源归属


#### A3 — Tailwind 4 + shadcn/ui Design System

- **路径**：`frontend/tailwind4-design-system/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐⭐⭐ | **学习周期**：1周

**📌 适用场景**：
- 新建 / 重写 `globals.css` 主题层
- 设计 / 调整敦煌金色调（#C8A45C 系）的 token
- 配置 next-themes 暗色 / 亮色切换
- 写 shadcn/ui 组件（cva + Radix Slot）
- 接 cva 复合变体

**🚫 不适用**：
- 仅做样式微调（直接改 className）
- 后端样式（用 `postgres-performance-tuning` 等）
- 部署样式（用部署类 skill）

**🔧 Workflow 步骤**（7 步）：
1. 配置 PostCSS
2. 写 `globals.css`（敦煌金主题）
3. 配置 shadcn `components.json`
4. `app/layout.tsx` 接 next-themes + next/font
5. 用 `cn()` helper
6. 写 cva 组件（敦煌金 + shadcn）
7. Next.js 配置

**⚠️ 避坑指南**（5 条）：
- 保留 `tailwind.config.js`
- 用 `@tailwind base/components/utilities` 三行（用 `@import "tailwindcss"`）
- 在 `@theme` 里直接写 hex/HSL — 用 OKLCH
- 忘了 `@custom-variant dark`
- 用 `data-theme` 策略（除非有特殊多主题需求）

**✅ 验收清单**（7 条）：
- [ ] `pnpm dev` 启动无 CSS 报错
- [ ] 切主题流畅无 FOUC
- [ ] `bg-primary` `text-foreground` 等 utility 正常工作
- [ ] shadcn `npx shadcn@latest add button` 成功
- [ ] 中文字体显示正确，无回退到默认
- [ ] `dark:bg-card` 等 dark 变体工作
- [ ] Chrome DevTools → Lighthouse 性能 ≥ 95


#### A4 — Core Web Vitals Audit (Next.js 15)

- **路径**：`frontend/nextjs-core-web-vitals-audit/SKILL.md`
- **难度**：⭐⭐⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：1周

**📌 适用场景**：
- 部署前性能门禁（Lighthouse ≥ 95）
- 分析 LCP / INP / CLS 不达标原因
- Bundle 体积优化
- 图片、字体优化
- 启用 PPR / dynamicIO 等实验能力

**🚫 不适用**：
- 后端优化（用 `postgres-performance-tuning` / `observability-three-pillars`）
- 仅样式调整（用 `tailwind4-design-system`）
- 

**🔧 Workflow 步骤**（4 步）：
1. 跑基线 Lighthouse
2. Bundle 分析
3. 关键优化清单
4. 验证

**⚠️ 避坑指南**（8 条）：
- `<img>` 直接用（必须 `next/image`）
- Web 字体无 `display: 'swap'`
- LCP 候选元素无 `priority`
- `'use client'` 放在整页（破坏 RSC 优势）
- `useEffect + fetch` 在 Client Component 中读数据
- 大图标库完整导入（lucide-react 优化）
- 大型编辑器不 `dynamic()` 拆分
- 


### 🟡 B. 后端工程


#### B1 — PostgreSQL Performance Tuning

- **路径**：`backend/postgres-performance-tuning/SKILL.md`
- **难度**：⭐⭐⭐ | **价值**：⭐⭐⭐⭐⭐ | **学习周期**：2周

**📌 适用场景**：
- 查询慢 / 接口超时
- 设计 / 修改 schema（索引策略）
- 高并发准备（连接池、分区）
- 大表（> 1000 万行）维护
- 多租户隔离（RLS）

**🚫 不适用**：
- 仅 CRUD 改写（无需调优）
- ORM 选型（Drizzle 已定）
- 部署层（用部署类 skill）
- 

**🔧 Workflow 步骤**（3 步）：
1. 找到慢查询
2. EXPLAIN ANALYZE
3. 索引设计

**⚠️ 避坑指南**（6 条）：
- 无脑加索引（写放大）
- `SELECT *`（IO 浪费）
- 大 OFFSET 翻页（性能崩）
- 在 Client Component 中跑长查询
- 不跑 `ANALYZE`（统计信息过期）
- 用 `now()` 当 created_at 但又想精确控制（用应用层时间戳）

**✅ 验收清单**（7 条）：
- [ ] 所有 WHERE 列有索引
- [ ] 所有 ORDER BY 列在前导索引中
- [ ] EXPLAIN 无 Seq Scan（> 1 万行表）
- [ ] 连接池配置
- [ ] `pg_stat_statements` 已启用
- [ ] 周自动 `ANALYZE` 任务
- [ ] 监控 dashboard（Grafana）已部署


#### B2 — Drizzle ORM Patterns

- **路径**：`backend/drizzle-orm-patterns/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：1周

**📌 适用场景**：
- 设计 schema（pgTable）
- 复杂查询（join、子查询、聚合）
- 事务（算力扣减、积分变更）
- Prepared Statements（高频查询）
- 数据迁移（drizzle-kit generate/migrate）

**🚫 不适用**：
- 选 ORM（Drizzle 已定）
- SQL 调优（用 `postgres-performance-tuning`）
- 数据库设计原则（用 `postgres-performance-tuning`）
- 

**🔧 Workflow 步骤**（8 步）：
1. Schema 定义
2. Drizzle Kit 配置
3. 生成迁移
4. 关系查询（Relations API）
5. 事务（算力扣减）
6. Prepared Statements（高频）
7. 软删除模式
8. 类型安全 + Zod

**⚠️ 避坑指南**（6 条）：
- 在事务内做 HTTP 请求（长事务）
- 不用 `for('update')` 就改余额（并发问题）
- 跨多步不事务（脏写）
- 软删除不建 `isNull(deletedAt)` 索引
- 用 `sql.raw()` 不 escape（注入风险）
- 用 drizzle-kit push 到生产（用 migrate）

**✅ 验收清单**（8 条）：
- [ ] 所有表有合适索引
- [ ] 所有金额变动有事务 + 行锁
- [ ] 所有高频查询 prepared
- [ ] 所有软删除列索引
- [ ] 所有 INSERT/UPDATE 有 Zod 校验
- [ ] migrations 目录已 git 跟踪
- [ ] Drizzle Studio 可用
- [ ] relations 单独文件（无循环依赖）


#### B3 — JWT + RBAC Best Practices

- **路径**：`backend/jwt-rbac-best-practices/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：3天

**📌 适用场景**：
- 新建登录 / 注册 / 注销
- 设计角色权限（admin / editor / user）
- 写 `middleware.ts` 鉴权
- Server Action 内重新鉴权
- Refresh Token 轮换

**🚫 不适用**：
- 仅 UI 调整（用 `tailwind4-design-system`）
- 仅 API 路由设计（用 `api-design-rest-conventions`）
- 数据库 schema（用 `drizzle-orm-patterns`）
- 

**🔧 Workflow 步骤**（7 步）：
1. Token 配置
2. 密码哈希
3. Login Route Handler
4. Middleware 鉴权
5. DAL（强制鉴权 + 资源校验）
6. Server Action 中再鉴权
7. Refresh Token 轮换

**⚠️ 避坑指南**（8 条）：
- 把 JWT 存 localStorage（XSS 风险）— 用 HttpOnly cookie
- 不验签就 decode JWT
- 只用 Middleware 鉴权（DAL 必须再校验）
- Access Token > 1 小时（暴露窗口）
- 不防时序攻击（用户不存在也要 hash）
- 不记录审计日志（合规 + 安全）
- bcrypt cost < 10（太容易被暴破）
- 弱 JWT secret < 32 bytes

**✅ 验收清单**（8 条）：
- [ ] JWT secret ≥ 32 bytes
- [ ] Access Token 15 min，Refresh 7 d
- [ ] Cookie HttpOnly + Secure + SameSite=Lax
- [ ] Middleware 覆盖所有需登录路由
- [ ] DAL `requireUser/requireRole/requireOwnership` 在每个 Action
- [ ] 密码 cost ≥ 12
- [ ] 时序攻击防御
- [ ] Rate limit 实施


#### B4 — RESTful API Design Conventions

- **路径**：`backend/api-design-rest-conventions/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：1周

**📌 适用场景**：
- 新建 API 端点（Route Handler）
- 设计错误码体系
- 统一响应格式
- 实现分页（cursor-based）
- 实现幂等性

**🚫 不适用**：
- Server Action 内部逻辑（用 `nextjs-app-router-patterns`）
- 仅鉴权（用 `jwt-rbac-best-practices`）
- 数据库 schema（用 `drizzle-orm-patterns`）
- 

**🔧 Workflow 步骤**（4 步）：
1. 用 `apiHandler` 包装器统一异常
2. 列表端点 + cursor 分页
3. 详情 + 写操作
4. 幂等性（防止重复点击 AI 生成）

**⚠️ 避坑指南**（7 条）：
- 用 OFFSET 做深度分页（性能崩）
- 不带 trace_id（难以排查）
- 错误只返回 "Internal Error"（无信息）
- 没幂等性的写操作（用户重试就重复扣费）
- 路径用动词（/api/getArtworks ❌ → /api/v1/artworks ✅）
- 返回 200 + 错误体（违反 HTTP 语义）
- 不验 origin（CSRF 风险）

**✅ 验收清单**（8 条）：
- [ ] 所有端点统一响应格式
- [ ] 所有错误走 `apiHandler` 包装
- [ ] 所有 mutation 幂等
- [ ] 列表用 cursor 分页
- [ ] 所有 endpoint 鉴权
- [ ] OpenAPI 文档生成
- [ ] origin 检查（CSRF）
- [ ] trace_id 全链路


#### B5 — Redis Caching Strategies

- **路径**：`backend/redis-caching-strategies/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐ | **学习周期**：3天

**📌 适用场景**：
- 热门数据缓存（纹样库、推荐位）
- AI 生成结果缓存（同 prompt 复用）
- 分布式 session
- 限流（counter）
- 分布式锁（防并发扣费）

**🚫 不适用**：
- 仅客户端缓存（用 SW / Memory）
- 单实例无并发（无需 Redis）
- 数据库 schema（用 `drizzle-orm-patterns`）
- 

**🔧 Workflow 步骤**（8 步）：
1. ioredis 连接
2. Cache-Aside（通用）
3. Cache-Aside 实战（纹样库）
4. AI 结果缓存（同 prompt 复用）
5. 限流（计数器）
6. 分布式锁（防并发扣费）
7. Pub/Sub（实时通知）
8. 缓存预热（启动时）

**⚠️ 避坑指南**（6 条）：
- 缓存算力余额（强一致场景）
- 无 TTL（缓存永远不过期）
- 不用 SETNX 写锁（race condition）
- 删除后立即回源（无防雪崩）
- 大 key（> 1MB，Redis 单线程阻塞）
- 不设 `maxmemory-policy: allkeys-lru`

**✅ 验收清单**（7 条）：
- [ ] ioredis 连接池配置
- [ ] 公共数据有 TTL
- [ ] 写时精确失效
- [ ] 命中率监控（> 70%）
- [ ] 限流走 Redis（多实例一致）
- [ ] 锁有 TTL + 唯一 token 释放
- [ ] Pub/Sub channel 命名空间清晰


### 🔵 C. AI 网关（核心）


#### C1 — AI Gateway — Multi-Provider

- **路径**：`ai-gateway/ai-gateway-multi-provider/SKILL.md`
- **难度**：⭐⭐⭐⭐ | **价值**：⭐⭐⭐⭐⭐ | **学习周期**：2周

**📌 适用场景**：
- 接入新的 AI Provider
- 设计 fallback 链（主备）
- 限流 + 配额管理
- 算力精确计量
- AI 任务队列

**🚫 不适用**：
- 仅前端 UI（用 `tailwind4-design-system`）
- 数据库 schema（用 `drizzle-orm-patterns`）
- 鉴权（用 `jwt-rbac-best-practices`）
- 

**🔧 Workflow 步骤**（8 步）：
1. Provider 抽象层
2. Provider 实现示例（智谱）
3. Fallback Chain
4. 任务队列
5. 流式响应（SSE）
6. Provider 配置表
7. 健康检查 Worker
8. 算力计量精度

**⚠️ 避坑指南**（6 条）：
- 同步 await AI 生成（用户卡死）
- 没幂等性的写（重复扣费）
- 算力 key 用 provider 价格（运营成本随时变）
- fallback chain > 3 层（慢）
- 不验签 webhook
- 单 Provider 故障打爆全部用户（熔断）

**✅ 验收清单**（8 条）：
- [ ] 所有 AI 端点异步化（队列 + 202）
- [ ] Fallback chain 配置
- [ ] Provider 健康检查
- [ ] 幂等性（UNIQUE 约束）
- [ ] 算力计量 schema + 表
- [ ] 流式响应 SSE
- [ ] Webhook 验签
- [ ] Rate limit


#### C2 — AI Prompt Engineering (敦煌主题中文)

- **路径**：`ai-gateway/ai-prompt-engineering-zh/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：1周

**📌 适用场景**：
- 写 / 优化中文 AI 提示词
- 设计敦煌文化风格预设
- 文生图 / 图生图 / 视频 / 3D 提示词模板
- 负面提示词
- 提示词链（多步生成）

**🚫 不适用**：
- Provider 接入（用 `ai-gateway-multi-provider`）
- 鉴权 / 队列（用 `ai-gateway` / `jwt-rbac`）
- 

**🔧 Workflow 步骤**（8 步）：
1. 提示词结构公式
2. 文生图模板
3. 提示词组装函数
4. 提示词链（多步生成）
5. 提示词评测（A/B）
6. 风格预设 Schema
7. 负面提示词库
8. 多语言提示词（国际化）

**⚠️ 避坑指南**（6 条）：
- 单一关键词「敦煌」（不够细）
- 中英文混杂（Provider 通常 prefer 单一语言）
- 抽象描述「美丽的」（无具体引导）
- 提示词 > 200 词（过长干扰）
- 不写 negativePrompt（无法排除）
- 不指定 aspectRatio（默认 1:1 可能不适合）

**✅ 验收清单**（5 条）：
- [ ] 至少 3 个窟号 / 时代 / 技法关键词
- [ ] 至少 2 个矿物颜料
- [ ] negativePrompt 完整
- [ ] aspectRatio 显式
- [ ] 评估 ≥ 0.7 相似度


#### C3 — AI Streaming SSE Patterns

- **路径**：`ai-gateway/ai-streaming-sse-patterns/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：3天

**📌 适用场景**：
- 实时显示 AI 生成进度
- Chat 流式响应
- 长任务状态推送
- 服务端 → 客户端单向实时通知
- AI 任务状态轮询替代

**🚫 不适用**：
- 双向通信（用 WebSocket）
- 仅一次性响应（普通 Response）
- 文件下载（不用 SSE）
- 

**🔧 Workflow 步骤**（7 步）：
1. Server 端 SSE Route Handler
2. Client 端 EventSource Hook
3. Chat UI 组件
4. AI 任务进度推送（服务端推送状态变更）
5. 反向压力（Backpressure）
6. 错误处理
7. nginx 配置（防缓冲）

**⚠️ 避坑指南**（6 条）：
- nginx 不关 buffering（延迟巨大）
- 没用 heartbeat（代理 60s 断）
- 客户端不处理断线重连
- 错误不发 SSE 事件（HTTP 错误客户端收不到）
- 流式 + 同步扣算力（用户体验差）
- 大消息 > 1MB（chunk 大小限制）

**✅ 验收清单**（7 条）：
- [ ] Content-Type: text/event-stream
- [ ] nginx `proxy_buffering off`
- [ ] 心跳 15s
- [ ] 客户端断开清理（Redis 订阅 / 定时器）
- [ ] 错误发 SSE 事件
- [ ] 重连机制（retry）
- [ ] 字符编码 utf-8


#### C4 — AI Cost / Power Metering

- **路径**：`ai-gateway/ai-cost-power-metering/SKILL.md`
- **难度**：⭐⭐⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：1周

**📌 适用场景**：
- 定义每个 AI 任务的算力成本
- 算力扣减 / 退还逻辑
- 充值 / 赠送 / 会员体系
- 对账系统（防止算力漂移）
- 防滥用（刷量识别）

**🚫 不适用**：
- Provider 接入（用 `ai-gateway-multi-provider`）
- 鉴权（用 `jwt-rbac-best-practices`）
- 数据库 schema 基础（用 `drizzle-orm-patterns`）
- 

**🔧 Workflow 步骤**（10 步）：
1. 任务成本定义
2. 动态定价（按参数）
3. 用户算力账户
4. 算力扣减（事务 + 行锁）
5. 退还（任务失败）
6. 在 AI Gateway 中集成
7. 充值
8. 月度对账
9. 防滥用（异常检测）
10. 用户算力 Dashboard

**⚠️ 避坑指南**（6 条）：
- 不用事务 + 行锁（并发扣减丢算力）
- 失败不退还（用户体验差）
- 充值不幂等（重复扣款）
- 没用 for('update')（脏写）
- 不记流水（无法对账）
- 不限流（被刷爆）

**✅ 验收清单**（8 条）：
- [ ] 每次扣减有事务 + 行锁
- [ ] 每次扣减写 power_records
- [ ] 失败自动退还
- [ ] 充值幂等（UNIQUE paymentId）
- [ ] 月度对账脚本
- [ ] 防滥用阈值
- [ ] 财务报表（每日 / 每月）
- [ ] 用户 Dashboard


### 🟣 D. 架构与可观测


#### D1 — Observability Three Pillars

- **路径**：`architecture/observability-three-pillars/SKILL.md`
- **难度**：⭐⭐⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：1周

**📌 适用场景**：
- 结构化日志（替代 console.log）
- Prometheus 指标采集
- OpenTelemetry 分布式追踪
- Sentry 错误追踪
- 真实用户监控（RUM）

**🚫 不适用**：
- 仅本地调试（console.log 足够）
- 不需要监控的 demo
- 

**🔧 Workflow 步骤**（10 步）：
1. 结构化日志（Pino）
2. Prometheus 指标
3. Next.js 内置埋点（instrumentation.ts）
4. /metrics 端点
5. OpenTelemetry 追踪
6. 手动 Span
7. Sentry 集成
8. 业务指标打点
9. Prometheus + Grafana 部署
10. Grafana Dashboard 模板

**⚠️ 避坑指南**（6 条）：
- `console.log` 替代 logger（无结构）
- 记录敏感数据（密码、API key）
- 不设采样率（性能开销）
- trace 采样 100%（生产）
- 不关联 request_id（无法跨服务排查）
- 不设告警（指标没意义）

**✅ 验收清单**（7 条）：
- [ ] 所有日志带 request_id
- [ ] 所有错误自动上报 Sentry
- [ ] /api/metrics 暴露 Prometheus 格式
- [ ] Grafana dashboard 部署
- [ ] 告警规则（错误率 > 1%, P99 > 2s）
- [ ] 敏感数据 redact
- [ ] 采样率分级（dev 100%, prod 10%）


#### D2 — Monolith → Microservices

- **路径**：`architecture/monolith-to-microservices/SKILL.md`
- **难度**：⭐⭐⭐⭐ | **价值**：⭐⭐⭐ | **学习周期**：2周

**📌 适用场景**：
- 单体应用代码量 > 50k 行
- 团队 > 5 人，模块冲突频繁
- 部分模块需要独立扩展（如 AI 生成 worker）
- 单点故障影响全局

**🚫 不适用**：
- 团队 < 3 人（沟通成本 > 解耦收益）
- 日活 < 1k（性能问题用缓存 / DB 优化解决）
- 项目早期（过早拆分是反模式）
- 

**🔧 Workflow 步骤**（10 步）：
1. 识别 Bounded Context（DDD）
2. 服务边界设计
3. Strangler Fig Pattern（绞杀者模式）
4. 数据分解
5. Saga 模式（分布式事务）
6. 服务间通信
7. 服务可观测性
8. 部署策略
9. 渐进式迁移路径（敦煌金项目 6 个月计划）
10. 反模式（不要做）


#### D3 — Domain-Driven Design — Bounded Context

- **路径**：`architecture/domain-driven-design-bounded-context/SKILL.md`
- **难度**：⭐⭐⭐⭐ | **价值**：⭐⭐⭐ | **学习周期**：1周

**📌 适用场景**：
- 复杂业务域建模（计费、AI 生成、内容）
- 微服务边界划分
- 重构混乱代码库
- 跨团队协作（统一语言）
- 业务规则经常变化

**🚫 不适用**：
- CRUD 简单应用（DDD 过重）
- 数据主导（用纯数据建模）
- 短期项目
- 

**🔧 Workflow 步骤**（11 步）：
1. 事件风暴（Event Storming）
2. 识别 Bounded Context
3. 通用语言（每 BC）
4. Aggregate 设计（以 Billing 为例）
5. Value Object
6. Domain Event
7. Repository（持久化抽象）
8. Application Service
9. 防腐层（ACL）
10. 模块目录结构
11. 集成策略

**⚠️ 避坑指南**（6 条）：
- 1 个 BC 用 1 个 entity（过度设计）
- 跨 BC 强事务（用 Saga）
- 共享 domain entity（用 ACL）
- 贫血模型（setter/getter 无行为）
- Domain Event 包含业务逻辑（应是无事实陈述）
- Repository 返回 ORM 实体（应返回领域对象）

**✅ 验收清单**（7 条）：
- [ ] 每个 BC 有清晰边界（接口 / ACL）
- [ ] 聚合根控制不变性
- [ ] 跨 BC 通过事件解耦
- [ ] 团队用同一通用语言
- [ ] Value Object 不可变
- [ ] Domain Event 已发布 + 已订阅
- [ ] 单测覆盖聚合行为


#### D4 — Sentry Error Tracking

- **路径**：`architecture/error-tracking-sentry-setup/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐ | **学习周期**：2天

**📌 适用场景**：
- 接入 Sentry（前后端）
- 上传 source maps
- 关联 release / commit
- 配置告警规则
- 自定义上下文（用户 / 业务）

**🚫 不适用**：
- 仅本地调试（用 console）
- 不需要监控的内部工具
- 

**🔧 Workflow 步骤**（14 步）：
1. 安装
2. 环境变量
3. sentry.client.config.ts（浏览器）
4. sentry.server.config.ts（Node 服务端）
5. sentry.edge.config.ts（Edge Runtime）
6. next.config.ts 集成
7. 用户上下文（在登录后调用）
8. 自定义业务上下文
9. Server Action 错误捕获
10. 关联 Release
11. Performance Monitoring
12. 告警规则（Web UI）
13. User Feedback（可选）
14. 隐私合规

**⚠️ 避坑指南**（6 条）：
- 采样率 100%（生产）
- 记录密码 / token 到 Sentry
- 不上传 source maps（堆栈不可读）
- 不关联 release（无法识别新引入错误）
- 忽略 ignoreErrors（Extension 噪音）
- PII 未脱敏（GDPR / 隐私）

**✅ 验收清单**（7 条）：
- [ ] server / client / edge 三端初始化
- [ ] 关联 commit + release
- [ ] source maps 上传
- [ ] 用户上下文绑定
- [ ] 告警规则配置
- [ ] 敏感数据脱敏
- [ ] 测试事件触发


### 🔴 E. 部署与运维


#### E1 — Docker Multi-stage Best Practices

- **路径**：`devops/docker-multistage-best-practices/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐⭐⭐ | **学习周期**：3天

**📌 适用场景**：
- 写 Dockerfile（Next.js, Node.js, Go, Python）
- 优化镜像体积（从 2GB → 200MB）
- CI/CD 镜像构建
- BuildKit 缓存优化
- 安全加固（非 root 用户）

**🚫 不适用**：
- 本地开发（dev 不需要 Docker）
- 单文件演示
- 

**🔧 Workflow 步骤**（12 步）：
1. Next.js 多阶段 Dockerfile
2. next.config.ts 启用 standalone
3. `.dockerignore`
4. docker-compose.yml（生产）
5. 多架构构建
6. Layer 缓存优化
7. BuildKit Cache Mounts
8. 镜像体积对比
9. 安全扫描
10. 镜像瘦身技巧
11. 日志配置
12. Secrets 管理

**⚠️ 避坑指南**（7 条）：
- 单阶段构建（镜像含源码）
- 用 `:latest` tag（生产）
- root 用户运行
- 写死 secrets 在 ENV
- 不写 `.dockerignore`
- 不写 HEALTHCHECK
- 不用 cache mounts

**✅ 验收清单**（8 条）：
- [ ] 镜像 < 300MB
- [ ] 非 root 用户
- [ ] HEALTHCHECK 通过
- [ ] 安全扫描无 critical
- [ ] 启动 < 10s
- [ ] 多阶段构建
- [ ] BuildKit cache 启用
- [ ] `.dockerignore` 完整


#### E2 — Nginx Reverse Proxy Hardening

- **路径**：`devops/nginx-reverse-proxy-hardening/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：3天

**📌 适用场景**：
- Nginx 代理 Next.js
- TLS 1.3 + HTTPS 配置
- 安全头（HSTS, CSP, X-Frame）
- gzip / Brotli 压缩
- WebSocket / SSE 代理

**🚫 不适用**：
- 仅开发环境（用 Next.js 自带）
- 用 Cloudflare / Vercel（无需 Nginx）
- 

**🔧 Workflow 步骤**（13 步）：
1. 基础反向代理
2. 安全头
3. gzip / Brotli
4. 限流
5. SSE 关键配置（防 buffering）
6. WebSocket
7. 文件上传大小（AI 上传参考图）
8. 缓存（Next.js 静态资源）
9. Let's Encrypt 自动续签
10. 性能调优
11. 监控 / 健康检查
12. 日志格式
13. 故障转移 / 多实例

**⚠️ 避坑指南**（7 条）：
- TLS 1.0/1.1（已不安全）
- 不设 HSTS（首屏可被降级）
- SSE 忘了关 buffering
- 上传大文件忘改 body size
- 不隐藏 server_tokens（泄露版本）
- 证书手动管理（用 Let's Encrypt 自动续）
- 不设 worker_connections（默认 1024）

**✅ 验收清单**（8 条）：
- [ ] HTTPS 启用（A+ 评级）
- [ ] HSTS preload list 提交
- [ ] SSE 流式测试通过
- [ ] 大文件上传测试
- [ ] 限流生效
- [ ] 证书自动续签
- [ ] gzip / Brotli 生效
- [ ] nginx -t 无报错


#### E3 — 1Panel Deployment Guide

- **路径**：`devops/1panel-deployment-guide/SKILL.md`
- **难度**：⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：2天

**📌 适用场景**：
- 部署到 1Panel 服务器
- 一键安装 PostgreSQL / Redis
- 配置反向代理 + 自动 SSL
- 设置定时任务（备份 / 证书续签）
- 防火墙规则

**🚫 不适用**：
- 本地开发
- 其他面板（宝塔 / aaPanel）
- K8s 集群
- 

**🔧 Workflow 步骤**（16 步）：
1. 1Panel 安装
2. 应用商店安装基础服务
3. 创建数据库
4. 创建网站（反代 Next.js）
5. 申请 SSL
6. 配置反向代理（流式支持）
7. 部署 Next.js 应用
8. systemd 服务
9. 1Panel 创建守护进程（替代 systemd）
10. 定时任务
11. 防火墙
12. 日志查看
13. 监控告警
14. 数据库迁移（部署后）
15. 升级流程
16. 故障排查

**⚠️ 避坑指南**（6 条）：
- 直接跑 `pnpm dev`（生产）
- 数据库 root 账户给应用
- 不备份就升级
- 防火墙开 22 给 0.0.0.0/0
- 证书不用自动续签
- 不看日志直接重启

**✅ 验收清单**（8 条）：
- [ ] 1Panel 登录正常
- [ ] PostgreSQL / Redis 运行
- [ ] Next.js 守护进程 active
- [ ] HTTPS A+ 评级
- [ ] 反代流式不 buffering
- [ ] 每日备份可恢复
- [ ] 防火墙最小化
- [ ] 监控告警配置


#### E4 — CI/CD GitHub Actions — Zero Downtime

- **路径**：`devops/cicd-github-actions-zero-downtime/SKILL.md`
- **难度**：⭐⭐⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：1周

**📌 适用场景**：
- 配置 CI/CD 流水线
- 自动 lint + typecheck + test
- Docker 镜像自动构建推送
- 蓝绿部署 / 滚动升级
- 自动发布（语义化版本）

**🚫 不适用**：
- 仅本地开发
- 其他 CI（GitLab CI, Jenkins）
- 

**🔧 Workflow 步骤**（10 步）：
1. 目录结构
2. CI 工作流
3. Docker 镜像构建
4. Sentry Release
5. 部署到 1Panel（SSH + 滚动升级）
6. 蓝绿部署（Zero Downtime）
7. 语义化版本（release-please）
8. 数据库迁移自动化
9. 缓存优化
10. Secrets 管理

**⚠️ 避坑指南**（6 条）：
- 在 main 直接 push 自动部署（无审批）
- 不备份就部署
- 不健康检查就标记成功
- 失败不自动回滚
- secrets 写在 workflow 文件
- 单 workflow 跑所有（拆分 + 并行）

**✅ 验收清单**（8 条）：
- [ ] CI 跑 lint + typecheck + test + build
- [ ] Docker 镜像构建成功
- [ ] Sentry release 关联
- [ ] 部署有审批（environment）
- [ ] 健康检查通过
- [ ] 失败自动回滚
- [ ] Slack 通知
- [ ] Secrets 安全


#### E5 — SSL/HTTPS Let's Encrypt Auto-renew

- **路径**：`devops/ssl-https-letsencrypt-auto-renew/SKILL.md`
- **难度**：⭐ | **价值**：⭐⭐⭐⭐ | **学习周期**：1天

**📌 适用场景**：
- 申请 Let's Encrypt 证书
- 自动续签（cron / systemd timer）
- 通配符证书（DNS-01）
- HSTS preload
- OCSP Stapling

**🚫 不适用**：
- 仅本地开发
- 用其他证书颁发机构（商业 CA）
- Cloudflare 自动证书
- 

**🔧 Workflow 步骤**（13 步）：
1. certbot 安装
2. 单域名申请
3. 通配符证书（DNS-01）
4. Nginx 配置（完整）
5. HSTS + 安全头
6. 自动续签
7. 通配符证书自动续签（DNS 插件 hook）
8. 证书监控
9. SSL Labs A+ 配置
10. 多域名 SAN 证书
11. 证书迁移到其他服务器
12. 故障排查
13. 强制 HTTPS 跳转

**⚠️ 避坑指南**（6 条）：
- 用自签证书（生产）
- 证书手动管理（忘续签 → 全站 down）
- TLS 1.0/1.1（已不安全）
- 不开 OCSP Stapling（验证慢）
- 提交 HSTS preload 但子域没 HTTPS
- 密钥文件权限过大（应 600）

**✅ 验收清单**（8 条）：
- [ ] 证书有效期 > 30 天
- [ ] 自动续签测试通过（`--dry-run`）
- [ ] TLS 1.2/1.3 only
- [ ] OCSP Stapling 工作
- [ ] HSTS header 正确
- [ ] SSL Labs A 评级
- [ ] HTTP → HTTPS 跳转
- [ ] 私钥权限 600


### 🟠 F. 进阶专题


#### F1 — Web3D Three.js Patterns

- **路径**：`frontend/web3d-threejs-patterns/SKILL.md`
- **难度**：⭐⭐⭐⭐ | **价值**：⭐⭐⭐ | **学习周期**：2周

**📌 适用场景**：
- 3D 作品查看器（`<model-viewer>` 或 Three.js）
- 自定义 3D 编辑器
- 浮雕预览
- Shader 效果（浮雕深度图）
- GLTF 模型优化

**🚫 不适用**：
- 仅静态 3D（用 `<model-viewer>` 标签即可）
- 不需要 3D 的模块
- 

**🔧 Workflow 步骤**（10 步）：
1. `<model-viewer>` 简单展示
2. three.js 自定义场景
3. GLTF 优化（Draco / Meshopt）
4. PBR 材质（金质感）
5. 自定义 Shader（浮雕效果）
6. 性能调优
7. Suspense + 懒加载
8. AR 预览（WebXR）
9. 动画（Mixamo / 自定义）
10. 截图 / 缩略图

**⚠️ 避坑指南**（6 条）：
- 客户端 SSR 3D（hydration error）
- 大模型未压缩（首屏慢）
- 不限制像素比（高端机卡）
- 不释放 GPU 资源（内存泄漏）
- shader 不带错误处理（黑屏）
- 持续 render 而不用 `controls.addEventListener('change')`

**✅ 验收清单**（7 条）：
- [ ] 模型加载 < 3s
- [ ] 60fps（中端机）
- [ ] 像素比 ≤ 2
- [ ] GPU 内存 < 200MB
- [ ] 移动端可交互
- [ ] 卸载时 dispose
- [ ] AR 模式可用


#### F2 — PWA Offline Experience

- **路径**：`frontend/pwa-offline-experience/SKILL.md`
- **难度**：⭐⭐⭐ | **价值**：⭐⭐ | **学习周期**：1周

**📌 适用场景**：
- 离线浏览作品 / 模板
- 离线 AI 生成队列（弱网）
- 安装到桌面 / 主屏
- 推送通知（生成完成）
- 后台同步（Background Sync）

**🚫 不适用**：
- 仅桌面端（无需 PWA）
- 完全在线场景
- 

**🔧 Workflow 步骤**（9 步）：
1. Web App Manifest
2. Service Worker（Workbox）
3. 安装提示
4. 离线页面
5. 后台同步（Background Sync）
6. 推送通知
7. IndexedDB 离线存储
8. iOS 适配
9. Lighthouse PWA 审计

**⚠️ 避坑指南**（6 条）：
- API POST 缓存（破坏数据）
- 不用 maxEntries（无限增长）
- 不处理离线 fallback（用户白屏）
- 不更新 SW（用户永远看不到新版）
- 忽略 iOS 适配（大量用户）
- 无 manifest.json（不能安装）

**✅ 验收清单**（7 条）：
- [ ] manifest.json + icons（192/512/maskable）
- [ ] SW 注册成功
- [ ] 离线可访问（DevTools 断网测试）
- [ ] Lighthouse PWA ≥ 90
- [ ] 安装按钮可用
- [ ] iOS 适配完整
- [ ] Background Sync 测试


#### F3 — i18n with next-intl

- **路径**：`frontend/i18n-next-intl-setup/SKILL.md`
- **难度**：⭐⭐ | **价值**：⭐⭐⭐ | **学习周期**：3天

**📌 适用场景**：
- 多语言（中英文切换）
- 敦煌文化国际化
- 日期 / 数字 / 货币本地化
- ICU MessageFormat（复数 / 性别）
- Server Component 翻译

**🚫 不适用**：
- 仅中文（无需 i18n）
- 仅前端展示（用 `useTranslations` 即可）
- 

**🔧 Workflow 步骤**（18 步）：
1. 安装
2. 路由策略（App Router）
3. i18n 配置
4. 中间件
5. 翻译文件
6. Server Component 翻译
7. Client Component 翻译
8. ICU MessageFormat（复数 / 插值）
9. 日期 / 数字 / 货币
10. 语言切换器
11. 元数据翻译
12. 日期 / 数字在 Server Component
13. AI Prompt 多语言
14. RTL 支持（阿拉伯 / 希伯来文）
15. 类型安全
16. 中文字体差异化
17. 测试
18. 翻译管理（Crowdin / Lokalise）

**⚠️ 避坑指南**（6 条）：
- 字符串硬编码（必须用 t()）
- 不用复数形式（"1 项 / 100 项"）
- 不区分日期格式（en-US MM/DD vs zh-CN YYYY-MM-DD）
- 不测所有 locale
- 翻译文件 key 拼写错（TS 类型检查）
- URL 不带 locale（多语言并存）

**✅ 验收清单**（8 条）：
- [ ] 所有 UI 文本走 t()
- [ ] 复数 / 插值正确
- [ ] 日期 / 货币本地化
- [ ] locale 路由工作
- [ ] 语言切换器
- [ ] SEO 元数据翻译
- [ ] 字体按 locale 切换
- [ ] 测试覆盖各 locale


---

## 🎯 学习路径建议（按执行 Sprint 排序）


### Sprint 1（本周，止血）
**必修**：B2, C4, B3, E1, D4
**理由**：解决致命 5 项 + 让部署可用

### Sprint 2-3（2-4 周，核心）
**必修**：C1, C2, C3, A1, A3, B1
**理由**：AI 网关 + 设计系统 = 核心竞争力

### Sprint 4-5（5-8 周，体系）
**选修**：B4, B5, A2, A4, D1, D3, E2, E3, E4, E5

### Sprint 6+（9+ 周，成熟）
**可选**：D2, F1, F2, F3
