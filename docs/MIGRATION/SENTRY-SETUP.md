# Sentry 接入指南 · Phase 9.13

> 敦煌金 AI 设计平台 · 错误追踪与告警

## 1. 快速启用（3 步）

### 1.1 注册 Sentry 项目

1. 访问 https://sentry.io 注册（GitHub OAuth 一键）
2. 创建项目：Platform = **Next.js**
3. 复制 **DSN**（格式：`https://<key>@<org>.ingest.sentry.io/<project>`）

### 1.2 配置环境变量

服务端（`.env.production`）：
```bash
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_RELEASE=1.0.0  # 可选：版本号（推荐 git commit SHA）
```

客户端（如需前端上报，加到 `.env.local`）：
```bash
NEXT_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
```

### 1.3 重新部署

```bash
docker compose up -d --build
# 或本地：pnpm next dev / pnpm next start
```

**未配置 DSN 时**：Sentry 自动跳过，零开销。生产环境建议**必须配置**。

## 2. 架构概览

### 2.1 文件清单

| 文件 | 角色 | 说明 |
|------|------|------|
| `sentry.server.config.ts` | 服务端 init | Next.js 标准，server 启动时加载 |
| `sentry.client.config.ts` | 客户端 init | 浏览器端加载（可选） |
| `src/lib/sentry/server.ts` | 兼容旧版 init | 备用 API（initSentryServer） |
| `src/lib/sentry/capture.ts` | 错误捕获 API | captureError / captureMessage / setSentryUser |

### 2.2 自动联动

```ts
// error-handler.ts · Logger 自动触发
import { createLogger } from '@/lib/error-handler';
const log = createLogger('my-module');
log.error('something went wrong', { userId: 123 });
// → 自动上报 Sentry（含 context.tags = { logger: 'my-module' }）
```

```ts
// 路由层手动捕获
import { captureError } from '@/lib/sentry/capture';
try {
  await riskyOperation();
} catch (err) {
  captureError(err, {
    tags: { route: '/api/orders' },
    level: 'error',
  });
  throw err; // 或自定义响应
}
```

### 2.3 用户追踪

登录/注册成功后自动调用 `setSentryUser()`，Sentry 错误将关联用户：

```ts
import { setSentryUser } from '@/lib/sentry/capture';
// 登录后
await setSentryUser({ id: user.id, email: user.email, username: user.nickname });

// 登出时
await clearSentryUser();
```

## 3. PII 自动脱敏

`captureError/captureMessage` 自动过滤敏感字段：

| 字段名包含 | 处理 |
|-----------|------|
| `password` / `token` / `apiKey` / `secret` / `jwt` / `authorization` / `cookie` | `[REDACTED]` |
| 整字段是邮箱 | `***@***` |
| 字符串中嵌入邮箱 | `us***@example.com`（保留首 2 字符） |

**配置层**：`sendDefaultPii: false`（不收集 IP/cookie/headers 默认字段）。

## 4. 采样与过滤

| 维度 | 生产 | 开发 |
|------|------|------|
| `tracesSampleRate` | 10% | 0% |
| `replaysOnErrorSampleRate` | 1% | 0% |
| `sendDefaultPii` | false | false |

**自动过滤**：
- 路径含 `/api/health`、`/api/metrics` 的事务不上报
- 错误类型：`AbortError`、`NetworkError`、`ECONNRESET`、Drizzle 连接终止

## 5. 告警规则（推荐配置）

进入 Sentry → Alerts → Create Alert Rule：

### 5.1 错误率告警（必开）

```
Metric: error count
Threshold: > 10 errors in 5 minutes
Environment: production
Notify: Slack #dunhuang-alerts / 邮件 oncall@yourdomain.com
```

### 5.2 性能告警（P95 > 1s）

```
Metric: p95(transaction.duration)
Threshold: > 1000ms
Time window: 5 minutes
Filter: transaction.op = http.server
```

### 5.3 关键错误优先通知

```
Filter: tags[feature] = auth OR tags[route] matches "/api/auth/*"
Threshold: > 1 error in 1 minute
Severity: critical
```

### 5.4 Release 健康监控

```
Metric: crash-free session rate
Threshold: < 99.5%
Time window: 1 hour
```

## 6. 常见问题

### Q: Sentry DSN 未配置会报错吗？
A: 不会。所有 capture 调用在无 DSN 时退化为 `console.error/log`，**零开销、零依赖**。

### Q: 上线后无错误上报？
A: 检查：
1. `SENTRY_DSN` 环境变量是否真的设置（`echo $SENTRY_DSN`）
2. 容器内是否能访问外网（`curl https://*.ingest.sentry.io`）
3. Sentry 项目 → Settings → Allowed Domains 是否包含你的域名

### Q: 错误太多刷屏？
A: 在 Sentry 项目 → Settings → Inbound Filters 配置：
- 禁用 `localhost` 报错
- 限制 `chrome-extension://` 报错
- 设置错误频率上限

### Q: PII 不小心上报了怎么办？
A: Sentry 项目 → Settings → Security & Legal → Data Scrubbing 开启：
- 默认会脱敏密码、token、cookie
- 自定义正则：`user@*\.com`（邮箱）
- 删除特定字段：到 Issues 详情 → "Delete & Discard"

## 7. 验证清单（部署前必查）

- [ ] `SENTRY_DSN` 已配置到生产环境
- [ ] 触发一次测试错误（`captureError(new Error('test'))`）确认 Sentry 收到事件
- [ ] 告警规则配置完成（错误率 + P95）
- [ ] 团队已加入 Sentry 项目（Settings → Members）
- [ ] Slack/邮件集成配置完成

## 8. 成本控制

| 套餐 | 月事件量 | 价格 |
|------|---------|------|
| Developer | 5K | 免费 |
| Team | 50K | $26/月 |
| Business | 500K | $80/月 |
| Enterprise | 5M+ | 自定义 |

**节省技巧**：
- 生产 traces 10% 采样（90% 性能事件不收费）
- 健康检查、metrics 端点过滤
- ignoreErrors 白名单（已知无害错误）

## 9. 相关资源

- Sentry Next.js 官方文档：https://docs.sentry.io/platforms/javascript/guides/nextjs/
- 错误事件查询：https://<org>.sentry.io/issues/
- 性能面板：https://<org>.sentry.io/performance/
- Release 健康：https://<org>.sentry.io/releases/

---

**维护者**：天枢 (DH-AI-FE-01) · 2026-08-04 · v1.0