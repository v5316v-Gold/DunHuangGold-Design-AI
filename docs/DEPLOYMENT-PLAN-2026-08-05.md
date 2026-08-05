# 🚀 敦煌金 AI 平台 · 部署计划与准备状态

> **更新**：2026-08-05
> **目标**：本机（Windows 11 + Docker Desktop）→ 局域网可用 → 公网商用

---

## 一、部署准备总览

### ✅ 已完成（本次会话）

| # | 任务 | 状态 | 说明 |
|---|------|:---:|------|
| 1 | **features 表 seed** | ✅ | 17 项功能写入 DB，全部启用 |
| 2 | **JWT 移除 localStorage** | ✅ | useAuth 改 HttpOnly cookie；45 处 fetch 加 `credentials: 'include'` |
| 3 | **端口固化 5000** | ✅ | package.json + dev.sh 统一 |
| 4 | **自动备份** | ✅ | `scripts/backup-db.sh` + Windows 计划任务（每日 03:00） |
| 5 | **env 对齐** | ✅ | 补 QWEN/MESHY/KIMI/API_KEY_ENCRYPTION/ALLOWED_ORIGIN |
| 6 | **Sentry 降级** | ✅ | 无 DSN 时 console 降级，代码就绪 |
| 7 | **lint 0 errors** | ✅ | require→import + spike 语法修复 |
| 8 | **worker 镜像** | ✅ | `dunhuang-ai-worker:latest` 构建成功 |
| 9 | **CRLF 修复** | ✅ | 6 个 .sh/Dockerfile 转 LF（修复容器内 build 崩溃） |
| 10 | **Docker 端口转发 bug** | ✅ | 127.0.0.1 → 0.0.0.0 |
| 11 | **数据库迁移** | ✅ | 7 个 SQL，22 张表 |
| 12 | **admin 用户** | ✅ | cf08328b-4c45-4b36-a4a8-19fd6779b890 |

### ⏳ 进行中

| # | 任务 | 状态 |
|---|------|------|
| 1 | web Docker 镜像构建 | 构建中（CRLF 修复后） |
| 2 | 子代理 credentials 收尾 | 44/44 完成，tsc 0 错误 |

---

## 二、完整部署架构

```
Windows 11 工作站（24 核 / 128GB / 双 4TB SSD）
│
├── 🐳 Docker Desktop（WSL2 后端）
│   ├── dunhuang-postgres   :5432  PostgreSQL 18.4（dunhuang1/dunhuang2026）
│   ├── dunhuang-redis-compose :6379 Redis 7
│   ├── dunhuang-minio      :9000/:9001  MinIO 对象存储
│   ├── dunhuang-web        :5000  Next.js 15.2.3（standalone）
│   └── dunhuang-worker     :—     BullMQ 消费者
│
├── 🖥️ 主机进程
│   ├── pnpm dev :5000（开发模式）
│   └── Windows 计划任务「DunhuangBackup」每日 03:00
│
└── 🌐 网络
    ├── 本机 IP：192.168.124.3
    └── 局域网访问：http://192.168.124.3:5000/login
```

---

## 三、部署执行清单（3 阶段）

### 阶段 A：本机可用（已完成 ✅）

```bash
# 1. 启动基础设施
cd /d/DunHuangGold-Design-AI-main
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis minio

# 2. 跑迁移 + seed
DATABASE_URL="postgresql://dunhuang1:dunhuang2026@localhost:5432/dunhuang" node scripts/migrate.js
npx tsx scripts/seed-features.ts

# 3. 启动 dev server（5000）
pnpm dev

# 4. 验证
curl http://localhost:5000/api/health   # → {"status":"ok",...}
```

### 阶段 B：Docker 全栈（进行中）

```bash
# 1. 构建 web 镜像（需先 pnpm build 生成 .next/standalone）
pnpm build
docker build -t dunhuang-ai-web:latest .

# 2. 启动全部服务
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 3. 验证 worker
docker logs -f dunhuang-worker   # 应显示 "Worker started" 无报错

# 4. 全栈健康检查
curl http://localhost:5000/api/health
```

### 阶段 C：公网商用（部署时配置）

```bash
# 1. 生成生产密钥
openssl rand -base64 32    # JWT_SECRET
openssl rand -hex 32       # API_KEY_ENCRYPTION_KEY

# 2. 填真实 API Key（.env.local）
SENTRY_DSN=...
QWEN_API_KEY=...
MESHY_API_KEY=...
MINIMAX_API_KEY=...
S3_ACCESS_KEY=... S3_SECRET_KEY=... S3_BUCKET=...

# 3. nginx + HTTPS（deploy/nginx.conf + certbot）
# 4. 防火墙放行 80/443
# 5. 配置监控（Sentry DSN + 可选 Prometheus）
```

---

## 四、验证清单（部署后必跑）

| 检查项 | 预期 | 命令 |
|--------|------|------|
| 健康检查 | `status: ok` | `curl localhost:5000/api/health` |
| 登录 | success | `curl -X POST localhost:5000/api/auth/login -d '{"email":"admin@dunhuang.com","password":"admin123"}'` |
| features | 17 项 | `SELECT count(*) FROM features` |
| worker | 进程存活 | `docker ps \| grep worker` |
| 备份 | dump 文件 | `ls /d/dunhuang-backups/` |
| 无 localStorage token | 检查 DevTools | 登录后 `localStorage.getItem('dunhuang_token') === null` |
| lint | 0 errors | `pnpm lint` |
| build | 通过 | `pnpm build` |

---

## 五、风险与注意事项

| 风险 | 说明 | 缓解 |
|------|------|------|
| 8748 被 Hermes 占用 | Hermes Studio 与 dev server 抢端口 | 已固化 5000，避免 8748 |
| Docker Desktop 端口转发 | WSL2 偶发不转发 | 已改 0.0.0.0 绑定 |
| 容器内 CRLF | Windows 编辑的 .sh 在 Linux 容器报错 | 已转 LF，新加脚本注意 |
| 备份恢复 | pg_dump custom 格式 | 用 `pg_restore -d dunhuang file.dump` |
| 生产密钥 | JWT/加密 key 泄漏 | 生产必须重新生成 |

---

## 六、后续 Sprint 建议（上线后）

| 优先级 | 任务 | 工作量 |
|:---:|------|:---:|
| P1 | 82% Client Components → RSC 化 | 2 周 |
| P1 | admin 1704 行拆分 | 1 周 |
| P1 | i18n + PWA | 1 周 |
| P2 | CI/CD（GitHub Actions） | 3 天 |
| P2 | ComfyUI 容器接入 | 需 GPU |
| P2 | Prometheus + Grafana | 2 天 |

---

*部署准备状态报告完。下一步：等 web 镜像构建完成 → 启动全栈 → 端到端验证。*
