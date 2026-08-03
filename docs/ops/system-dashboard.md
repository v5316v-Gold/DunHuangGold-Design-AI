# 系统健康面板与运维中心 · 部署与验收文档

> 路径：docs/ops/system-dashboard.md
> 版本：1.0.0（2026-08-03）
> 覆盖：任务一~任务五（系统健康面板 / 任务中心 / 模型中心 / 自动健康检查告警）

---

## 一、功能总览

| 模块 | 路由/入口 | 说明 |
|---|---|---|
| 系统健康面板 | `/admin/system` | 实时显示 API/Postgres/Redis/Worker/ComfyUI/存储/第三方 API/GPU |
| 任务中心 | `/admin/tasks` | 任务列表/详情/重试/取消，记录执行器/耗时/重试/错误 |
| 模型中心 | `/admin/models` | LoRA/Base Model/ControlNet 上传、登记、启停、SHA256 校验 |
| 健康检查告警 | health-worker | 定时探测关键依赖，异常高亮 + 通道通知 |

---

## 二、架构分层（复用五层架构）

```
L1 前端：/admin/system · /admin/tasks · /admin/models（'use client' 页面）
         ↓ fetch
L2 API：/api/admin/system · /api/admin/tasks(+/[id]) · /api/admin/models(+/upload)
         requireAdmin 鉴权 + logAudit 审计
         ↓
L4 数据：system 实时探测（不落库）/ tasks 表（扩展字段）/ models 表（新建）
         ↓
L5 执行：health-worker（定时探测 + 告警）· ComfyUI（GPU/队列探测源）
```

**约束遵守**：
- ✅ 前端只调 `/api/admin/*`，不直连执行层
- ✅ 所有 API requireAdmin + logAudit
- ✅ 复用 system-health.ts / alerts.ts / storage / redis / db

---

## 三、部署方式

### 3.1 依赖项

| 依赖 | 版本 | 用途 |
|---|---|---|
| PostgreSQL | 15+ | tasks/models 表 |
| Redis | 7+ | Worker 探测 / 队列 |
| ComfyUI | 任意 | GPU 显存 + 队列长度探测（`/system_stats` + `/queue`）|
| 对象存储（可选） | S3/R2/本地 | 存储连通性探测 |

### 3.2 环境变量（新增）

```env
# 健康检查（health-worker）
HEALTH_CHECK_INTERVAL=60000        # 探测间隔 ms（默认 60s）
HEALTH_ALERT_THRESHOLD=2           # 连续异常次数才告警（防抖动）

# 告警通道（可选）
ALERT_WEBHOOK_URL=                 # 钉钉/企微/Slack 机器人 webhook
SMTP_HOST=                         # 邮件告警（预留，未实现发送）
ALERT_EMAIL=                       # 收件邮箱

# 模型中心
MODELS_DIR=./models                # 模型落盘目录（执行机）

# ComfyUI（已存在）
COMFYUI_HOST=http://localhost:8188
```

### 3.3 Docker 部署

```bash
# 1. 构建（含 health-worker）
bash scripts/build-workers.sh
# 产物: dist-workers/orchestrator-worker.js + health-worker.js

# 2. 启动全部服务
docker compose up -d
# 服务: app / worker / health-worker / db / redis / nginx

# 3. 数据库迁移（models/tasks 扩展字段）
# 执行 SQL: src/db/migrations/008_ops_center.sql（若已生成）
```

### 3.4 本地开发

```bash
pnpm dev            # 前端 + API
npx tsx workers/health-worker.ts   # 健康检查 worker（终端观察）
```

---

## 四、数据库变更

### tasks 表扩展（任务二）

```sql
ALTER TABLE tasks ADD COLUMN feature_code VARCHAR(50);
ALTER TABLE tasks ADD COLUMN executor VARCHAR(50);
ALTER TABLE tasks ADD COLUMN retry_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE tasks ADD COLUMN max_retries INTEGER DEFAULT 3 NOT NULL;
ALTER TABLE tasks ADD COLUMN cancelled_at TIMESTAMP;
```

### models 表（任务三）

```sql
CREATE TABLE models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type VARCHAR(30) NOT NULL,          -- lora / base-model / controlnet
  name VARCHAR(100) NOT NULL,
  file_path TEXT,
  original_filename VARCHAR(255),
  version VARCHAR(30) DEFAULT '1.0.0',
  file_size BIGINT DEFAULT 0,
  sha256 VARCHAR(64),
  bound_features JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT TRUE NOT NULL,
  trigger_words JSONB DEFAULT '[]',
  base_model VARCHAR(100),
  weight NUMERIC(3,2) DEFAULT '0.8',
  description TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX models_type_idx ON models(model_type);
CREATE INDEX models_enabled_idx ON models(enabled);
CREATE INDEX models_sha_idx ON models(sha256);
```

---

## 五、验收标准（量化）

### 5.1 系统健康面板（任务一）

- [ ] `/admin/system` 页面可访问（admin 角色）
- [ ] 6 个检查项（postgres/redis/workers/comfyui/storage/thirdParty）全部展示
- [ ] 状态颜色正确：ok=绿 / degraded=琥珀 / down=红 / unknown=灰
- [ ] ComfyUI 卡片显示 GPU 显存（used/total/百分比）+ 队列长度（running/pending）
- [ ] Worker 卡片显示在线数
- [ ] 页面 30 秒自动刷新
- [ ] 聚合状态：任一 down → 面板顶部琥珀色高亮
- [ ] GET /api/admin/system 响应 < 6 秒（并行探测 3-5s）
- [ ] 非 admin 访问返回 403
- [ ] 每次访问写入 audit_logs（action: system.health-check）

### 5.2 任务中心（任务二）

- [ ] `/admin/tasks` 页面可访问
- [ ] 列表展示：任务ID/功能/状态/执行器/进度/重试/耗时/创建时间
- [ ] 状态筛选（pending/running/succeeded/failed/cancelled）生效
- [ ] 分页正确（page/pageSize）
- [ ] 重试操作：status → pending，retryCount+1，清 error
- [ ] 取消操作：status → cancelled，cancelledAt 记录
- [ ] 失败任务重试、运行中任务取消的按钮可用
- [ ] 写 audit_logs（tasks.retry / tasks.cancel）

### 5.3 模型中心（任务三）

- [ ] `/admin/models` 页面可访问
- [ ] 类型筛选（lora/base-model/controlnet）生效
- [ ] 上传文件：落盘到 MODELS_DIR/{type}/，文件名含 SHA256 前 8 位
- [ ] 元数据入库：name/version/fileSize/sha256(64位)/boundFeatures/weight
- [ ] 启用/禁用开关即时生效
- [ ] 删除有确认 + audit
- [ ] SHA256 与文件实际哈希一致（64 位 hex）
- [ ] 写 audit_logs（models.upload/create/update/delete）

### 5.4 健康检查告警（任务四）

- [ ] health-worker 可独立构建（dist-workers/health-worker.js）
- [ ] 定时探测（默认 60s）执行 6 项检查
- [ ] 连续 2 次异常才告警（防抖动）
- [ ] 恢复后发送 info 通知
- [ ] 控制台通道始终可用
- [ ] ALERT_WEBHOOK_URL 配置后走 webhook（钉钉/企微兼容）
- [ ] 异常状态在面板高亮（degraded 琥珀 / down 红）
- [ ] 邮件通道预留（isConfigured 返回 false，不误报）

### 5.5 架构约束

- [ ] 前端零直连执行层（全部走 /api/admin/*）
- [ ] 所有 admin API requireAdmin
- [ ] 所有写操作 logAudit
- [ ] ts-check 0 错误
- [ ] production build 通过

---

## 六、告警通道配置示例

### 钉钉机器人

```env
ALERT_WEBHOOK_URL=https://oapi.dingtalk.com/robot/send?access_token=xxx
```
告警格式：markdown，含级别/来源/时间/详情（钉钉机器人原生支持）。

### 企业微信机器人

```env
ALERT_WEBHOOK_URL=https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx
```
（webhook 格式兼容 markdown，钉钉/企微通用）

### 邮件（预留）

```env
SMTP_HOST=smtp.example.com
SMTP_USER=alert@example.com
SMTP_PASS=xxx
ALERT_EMAIL=ops@example.com
```
当前 `EmailAlertChannel.isConfigured()` 已实现判断，发送逻辑 TODO（避免误报成功）。

---

## 七、故障排查

| 现象 | 可能原因 | 处理 |
|---|---|---|
| 面板显示 postgres down | DATABASE_URL 错误/DB 未启动 | 检查连接串 + pg_isready |
| redis down | Redis 未启动/端口错 | redis-cli ping |
| workers 在线数为 0 | worker 未启动/队列名不匹配 | 检查 docker compose ps + 队列名 ai-tasks |
| comfyui down | ComfyUI 未启动/端口错 | curl /system_stats |
| storage down | S3/R2 凭据错/本地目录不可写 | 检查 MODELS_DIR 权限 |
| GPU 显存不显示 | ComfyUI 版本不返回 devices | 检查 /system_stats 原始响应 |
| 告警没发 | 阈值未达/通道未配置 | 检查 HEALTH_ALERT_THRESHOLD + 通道日志 |

---

## 八、后续演进（预留）

1. **告警路由**：按级别分发（critical→钉钉+电话，warning→邮件）
2. **告警聚合**：相同告警 30 分钟内去重合并
3. **历史趋势**：健康检查结果落库，展示 24h 可用性曲线
4. **自愈**：Redis/DB 故障自动重启（K8s liveness）
5. **SLO 报告**：基于 health 历史数据生成月度可用性报告
