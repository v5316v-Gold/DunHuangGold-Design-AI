# 🖥️ 本机部署方案 — 敦煌金 AI 设计平台

> **目标**：把这台 Windows 11 工作站打造成敦煌金 AI 平台的**本地开发 + 演示 + 准生产部署**支撑环境
> **生成时间**：2026-08-05
> **基于**：硬件/软件扫描结果

---

## 📊 一、本机硬件盘点（实测）

| 维度 | 配置 | 评级 |
|------|------|:---:|
| **OS** | Windows 11 Pro 24H2 (10.0.26200) | ✅ |
| **CPU** | Intel Core Ultra 9 285K（24 核 / 24 线程 / 3.7 GHz） | 🚀 旗舰 |
| **内存** | 128 GB DDR5 | 🚀 服务器级 |
| **C 盘** | 1 TB SSD（668 GB 空闲） | ✅ |
| **D 盘** | 3.8 TB SSD — **致钛 TiPlus7100**（1.2 TB 空闲）| ✅ 项目盘 |
| **E 盘** | 2.8 TB SSD — **致钛 TiPlus7100**（2.1 TB 空闲） | 🚀 数据盘 |
| **GPU** | 待查（需 `nvidia-smi` 确认是否可跑 ComfyUI）| ⚠️ |
| **Docker** | 29.6.2 Desktop + Compose v5.3.1 | ✅ |
| **Node** | v24.18.0 + pnpm 11.1.3 | ✅ |
| **WSL** | Ubuntu 22.04（已装但 Stopped）| ✅ |
| **1Panel** | 已装（maxkb / ollama / open-webui 在跑）| ✅ |

---

## 🚨 二、当前现状问题

### 2.1 项目代码状态

| 项 | 状态 |
|----|------|
| 仓库位置 | `D:\DunHuangGold-Design-AI-main` |
| 当前分支 | `main`（与 GitHub 同步 +1 commit） |
| Node 版本 | 项目要求 `pnpm>=9.0.0`、本机 11.1.3 ✅ |
| **Docker daemon** | ⚠️ **刚启动，未配置开机自启** |
| **数据库** | ⚠️ PG 密码已重置为 `dunhuang2026`（之前默认密码未找到）|
| **dev server** | 8748 跑着，但代码可能是旧 master 分支 |
| **依赖** | ⚠️ 远程升 Next.js 15.2.3，需重装 `node_modules` |

### 2.2 端口冲突图

| 端口 | 当前占用 | 用途 |
|:---:|----------|------|
| **3000** | open-webui (1Panel) | ⚠️ Next 默认端口被占 |
| **5000** | Hermes (内部) | ⚠️ Next.js fallback 到 8748 |
| **5432** | dunhuang-db | ✅ PostgreSQL |
| **6379** | dunhuang-redis | ✅ Redis |
| **8080** | maxkb (1Panel) | ⚠️ 可能与本地后端冲突 |
| **8748** | dev server (旧) | 当前 Next dev |
| **8648** | Hermes | 工具内部 |
| **9000-9001** | dunhuang-minio | ✅ 对象存储 |
| **11434** | ollama | ✅ AI 模型 |
| **2179** | — | 未知服务 |

---

## 🎯 三、本机部署定位

由于硬件极其强劲（24 核 + 128GB + 4TB×2 SSD），本机**完全可以承担**：

| 定位 | 说明 | 推荐指数 |
|------|------|:---:|
| 🅰️ **本地开发环境** | pnpm dev + IDE 调试 | ⭐⭐⭐⭐⭐ |
| 🅱️ **Demo / 演示环境** | 局域网内对外展示 | ⭐⭐⭐⭐⭐ |
| 🅲️ **准生产环境** | Docker Compose 全栈（含 worker） | ⭐⭐⭐⭐ |
| 🅳️ **AI 模型推理节点** | 用本机 ollama + GPU 跑大模型 | ⭐⭐⭐⭐ |
| 🅴️ **CI 节点** | pnpm test / docker build | ⭐⭐⭐⭐ |
| 🅵️ **生产主服务器** | 公网商用 | ❌ 不推荐（需独立服务器） |

---

## 🛠 四、推荐部署架构（Docker Compose 全栈）

```
┌──────────────────────────────────────────────────────────────┐
│              本机 24 核 128GB 工作站（Windows 11）              │
├──────────────────────────────────────────────────────────────┤
│  📦 Docker Compose Stack（项目目录: D:\DunHuangGold-Design-AI-main）│
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  nginx (反向代理 + SSL)  :80/:443                     │    │
│  │  - host.docker.internal → 192.168.124.3              │    │
│  └───────┬────────────────────────────┬──────────────────┘    │
│          │                            │                       │
│  ┌───────▼──────────┐       ┌─────────▼──────────────┐      │
│  │  app (Next.js)   │       │  worker (BullMQ)        │      │
│  │  port: 5000      │◄──────│  port: -                │      │
│  │  CPU: 4  MEM: 8GB │       │  CPU: 2  MEM: 4GB       │      │
│  └──────┬───────────┘       └─────────┬──────────────┘      │
│         │                             │                       │
│  ┌──────▼─────────────────────────────▼──────────────────┐    │
│  │  基础设施（已通过 1Panel 外部运行，复用）              │    │
│  │  ├─ postgres:18-alpine   (localhost:5432)             │    │
│  │  ├─ redis:7-alpine       (localhost:6379)             │    │
│  │  └─ minio                (localhost:9000/9001)        │    │
│  └───────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  AI 推理（共用 1Panel 资源）                           │    │
│  │  ├─ ollama (localhost:11434) — 已装 LLaMA / Qwen     │    │
│  │  ├─ ComfyUI (本地 Python 启动，或独立容器)            │    │
│  │  └─ open-webui (localhost:3000) — AI 对话前端        │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 五、立即执行步骤（10 步走通）

### Step 1：配置 Docker 开机自启 + 资源限制

```powershell
# 设置 Docker Desktop 开机自启
Set-Service com.docker.service -StartupType Automatic

# 分配资源（Docker Desktop → Settings → Resources）
# CPU: 16 / 24（留 8 核给 Windows）
# Memory: 64 / 128 GB（留 64 GB 给本机其他应用）
# Disk image size: 500 GB（C 盘）
```

### Step 2：拉取最新代码 + 清理旧依赖

```bash
cd /d/DunHuangGold-Design-AI-main
git pull origin main
git stash list  # 确认备份还在
# 重装依赖（远程升 Next.js 15.2.3）
yes | pnpm install --reporter=silent
```

### Step 3：恢复数据库密码到 PG `.env.local`

```bash
# .env.local 已配置好（dunhuang2026）
grep DATABASE_URL /d/DunHuangGold-Design-AI-main/.env.local
# → postgresql://postgres:dunhuang2026@localhost:5432/dunhuang
```

### Step 4：用 docker-compose 启动项目（开发模式）

```bash
cd /d/DunHuangGold-Design-AI-main
docker compose -f docker-compose.yml up -d app
# 或用 .env.development 配置
```

### Step 5：用 docker-compose.test.yml 起测试栈

```bash
cd /d/DunHuangGold-Design-AI-main
docker compose -f docker-compose.test.yml up -d
# 启动：db (5433) + redis (6380) + minio + app + worker
```

### Step 6：跑迁移 + 健康检查

```bash
# 等容器启动后
docker exec dunhuang-ai pnpm db:push
# 或
docker exec dunhuang-ai node scripts/migrate.js

# 健康检查（远程 main 已拆分 /api/ping 和 /api/health）
curl http://localhost:5000/api/ping    # 应 200
curl http://localhost:5000/api/health  # 应 200（依赖全好）或 503（降级）
```

### Step 7：浏览器验证

打开浏览器 → `http://localhost:5000/login` → 用 `admin@dunhuang.com / admin123` 登录

### Step 8：配置 Nginx 反代（如需对外）

```bash
# 编辑 deploy/nginx.conf → 改 server_name 为本机 IP 192.168.124.3
docker compose up -d nginx
# 测试：curl http://192.168.124.3/
```

### Step 9：启动 Worker 容器

```bash
docker compose up -d worker
# 验证：docker logs -f dunhuang-worker
```

### Step 10：监控 + 日志

```bash
# Prometheus metrics（待部署）
# Sentry（已集成 src/lib/sentry/capture.ts）
# 简单日志：
docker compose logs -f --tail=100 app
```

---

## 📋 六、立即可用的部署命令清单

### 6.1 一键启动开发环境

```bash
# 终端 1：dev server
cd /d/DunHuangGold-Design-AI-main && pnpm dev

# 终端 2：worker（如果有）
cd /d/DunHuangGold-Design-AI-main && pnpm worker
```

### 6.2 一键启动 Docker 全栈

```bash
cd /d/DunHuangGold-Design-AI-main
docker compose -f docker-compose.test.yml up -d
docker compose -f docker-compose.yml up -d app nginx
```

### 6.3 验证脚本

```bash
# /c/Users/admin/AppData/Local/Temp/verify-deploy.sh
#!/bin/bash
echo "=== Docker ==="; docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""; echo "=== Health ==="
curl -s -o /dev/null -w "  /api/ping  %{http_code}\n" http://localhost:5000/api/ping
curl -s -o /dev/null -w "  /api/health %{http_code}\n" http://localhost:5000/api/health
curl -s -o /dev/null -w "  /login     %{http_code}\n" http://localhost:5000/login
echo ""; echo "=== DB ==="
PGPASSWORD=dunhuang2026 psql -h localhost -U postgres -d dunhuang -c "SELECT count(*) as user_count FROM users"
```

---

## ⚙️ 七、本机优化建议

### 7.1 系统级

| 优化 | 命令 |
|------|------|
| **禁用 Windows Defender 实时保护**（仅限本机） | Windows Security → Virus protection → Real-time protection: Off |
| **设置高性能电源计划** | `powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c` |
| **禁用 Cortana / Search 索引** | 服务 → Windows Search → Disabled |
| **增加虚拟内存** | 系统属性 → Performance → Advanced → Paging file: 8192 MB |

### 7.2 Docker 级

```jsonc
// ~/.docker/daemon.json
{
  "storage-driver": "overlay2",
  "default-ulimits": {
    "nofile": { "Name": "nofile", "Hard": 65536, "Soft": 32768 }
  },
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "100m",
    "max-file": "5"
  }
}
```

### 7.3 项目级（远程已优化大部分）

| 项 | 远程状态 | 本机是否要改 |
|----|:---:|:---:|
| `.npmrc` 用 `node-linker=hoisted` | ✅ | 不改 |
| `pnpm-lock.yaml` 锁文件 | ✅ | 不改 |
| `next.config.ts` standalone build | ✅ | 不改 |
| `Dockerfile.worker` Worker 镜像 | ✅ | 不改 |

---

## 🌐 八、网络与访问

### 8.1 本机 IP

- `192.168.124.3`（WLAN，主 IP）
- `172.30.112.1`（vEthernet，Docker 内部）
- `127.0.0.1`（本机回环）

### 8.2 局域网访问

```bash
# 同 WiFi 的同事可访问：
http://192.168.124.3:5000/login
http://192.168.124.3/login  # 通过 Nginx 80 端口
```

### 8.3 公网访问（需路由器端口转发 + 域名）

⚠️ **不建议用本机做生产公网服务器**：
1. Windows 桌面系统抗 DDoS 弱
2. 家庭宽带上行带宽小
3. 7×24 运行电费高
4. 没有专业防火墙

---

## 📈 九、监控与维护

### 9.1 必备监控

| 监控 | 推荐方案 |
|------|----------|
| **容器健康** | Docker Desktop UI + `docker ps` |
| **进程资源** | Task Manager → Performance / `Get-Process` |
| **磁盘** | `Get-PSDrive` / CrystalDiskInfo |
| **日志** | `docker logs -f` / `Get-EventLog -LogName Application` |
| **应用日志** | Sentry（已集成）+ 本地 `logs/` |
| **Prometheus** | 远程 main 已规划，本机可先不部署 |

### 9.2 日常维护

```bash
# 每周清理
docker system prune -af  # 清理无用镜像/容器
docker volume prune       # 清理无用卷（注意：会清 PG 数据！）

# 每月备份
docker exec dunhuang-db pg_dump -U postgres dunhuang > /d/backups/dunhuang_$(date +%Y%m%d).sql
```

---

## 🎯 十、5 个建议立即做的事

| # | 任务 | 时间 | 价值 |
|---|------|:---:|:---:|
| **1** | 重装依赖（远程升 Next 15.2.3）| 5 分 | 跑最新代码 |
| **2** | 重启 dev server 让它加载新代码 | 1 分 | 验证同步成功 |
| **3** | 把 `dunhuang2026` 写进 `.env.local` 模板 | 5 分 | 团队复用 |
| **4** | 跑 docker-compose.test.yml 体验全栈 | 10 分 | 验证 worker / migrate |
| **5** | 配置 Docker Desktop 开机自启 + 资源限制 | 5 分 | 稳定运行 |

---

## 📞 十一、常见问题

### Q1：远程 main 的代码能不能跑？
**A**：能，但需要先重装依赖（`pnpm install`），因为远程升了 Next.js 15.2.3。

### Q2：本机能跑 ComfyUI 吗？
**A**：能，但需要：
- NVIDIA GPU（待 `nvidia-smi` 确认）
- 安装 NVIDIA Container Toolkit
- 至少 8GB 显存

### Q3：1Panel 套件（maxkb / ollama）能跟项目一起跑吗？
**A**：能。它们的资源占用独立，不冲突。建议：
- ollama 用作本地 LLM（项目 AI 网关可接入）
- maxkb 作为知识库（项目客服系统可对接）

### Q4：怎么切换 PG 密码？
```bash
docker exec -u postgres dunhuang-db psql -c "ALTER USER postgres WITH PASSWORD '新密码';"
# 然后更新 .env.local
```

### Q5：dev server 端口冲突怎么办？
```bash
# 方案 A：杀掉占用 5000/8748 的进程
# 方案 B：换端口启动
cd /d/DunHuangGold-Design-AI-main
pnpm dev -- -p 5500  # Next.js 15 支持
```

---

## 📂 十二、文档归档

本方案已保存到：
- `C:\Users\admin\AppData\Local\Temp\DEPLOYMENT-PLAN.md`（本文件）
- 待提交到项目：`docs/LOCAL-DEPLOYMENT-GUIDE.md`

---

**下一步建议**：
1. 立即跑 `pnpm install` 重装依赖
2. 重启 dev server 让它加载远程 main 代码
3. 跑 `docker compose -f docker-compose.test.yml up -d` 体验全栈
4. 您确认后，我再针对每一步做详细输出
