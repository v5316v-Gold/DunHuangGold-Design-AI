# 监控告警（O13 骨架）

`scripts/check-alerts.mjs` 拉取并聚合两类告警：
1. **Sentry**（需配置 `SENTRY_API_TOKEN/ORG/PROJECT`）— 第三方 SaaS 错误监控
2. **项目内** `/api/admin/alerts` — 自带 alerts 聚合（24h 窗口）

输出：JSON 摘要 + 按 fatal/error/warning/info 分组计数。退出码 0/1/2 可被 cron / monitoring 触发。

## 配置 Sentry

```bash
# Sentry → Settings → Auth Tokens → 创建 token
export SENTRY_API_TOKEN=sntrys_...
export SENTRY_ORG=your-org
export SENTRY_PROJECT=dunhuang-ai
node scripts/check-alerts.mjs
```

## 项目内 alerts（无需配置）

```bash
# 默认连 localhost:5000
node scripts/check-alerts.mjs
```

输出：
```json
{
  "timestamp": "2026-08-23T08:00:00Z",
  "counts": { "fatal": 0, "error": 2, "warning": 5, "info": 1 },
  "total": 8,
  "fatalError": 2
}
```

退出码：
- `0`：无 fatal/error（cron 不告警）
- `1`：有 fatal/error（cron 触发通知）
- `2`：脚本本身错误

## 通知渠道集成

### Sentry → 钉钉/Slack webhook（推荐）

Sentry Dashboard → Settings → Integrations → 配 webhook。Sentry 触发 fatal 事件 → 推送到钉钉/Slack。

### 项目内 cron 定时拉取

```bash
# crontab 每 5 分钟拉一次
*/5 * * * * cd /path/to/repo && /usr/bin/node scripts/check-alerts.mjs | /usr/bin/curl -X POST https://oapi.dingtalk.com/robot/send?access_token=XXX
```

### Prometheus exporter 集成

把脚本输出转成 Prometheus 指标（包装一层）：
```yaml
# prometheus.yml
- job_name: dunhuang_alerts
  static_configs:
    - targets: ['localhost:9100']
```

需要时可加 `prom-client` 输出格式。

## 已知告警源

| 来源 | 内容 |
|---|---|
| `/api/admin/alerts` | 24h 内 critical/warn/info + 任务失败 + 死信任务 + ComfyUI 错误 + audit events |
| Sentry | 未捕获异常 + 性能问题 |
| `/api/admin/system` | DB / Redis / Workers / ComfyUI 健康 |
| `/api/health` | 整体聚合健康度 |

## 待用户配置

- [ ] 创建 Sentry 项目并填 `SENTRY_*` env
- [ ] 配置钉钉/Slack webhook
- [ ] （可选）配置 Prometheus exporter
- [ ] （可选）配置 Sentry → 邮件/短信告警
