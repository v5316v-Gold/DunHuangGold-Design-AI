# 敦煌金 AI 设计平台 - 部署计划

> **⚠️ 弃用声明（2026-08-15，2026-08-16 更新）**：本文档的 coze 时代旧内容（架构图含 "Coze API"、依赖 Supabase、`/app/work/logs/bypass` 路径、1Panel 早期部署脚本、1Panel F 盘部署、3000/pm2-error.log 等）已被**全部删除**，与当前 Docker Compose（postgres 18.4-alpine + redis 7-alpine + Next.js standalone + BullMQ Worker）部署架构不符。
>
> **请改阅单一可信源**：
> - 架构（部署章节）：[`docs/ARCHITECTURE.md` §九 部署](docs/ARCHITECTURE.md)
> - 修复记录（部署相关）：[`docs/PRODUCTION-FIXES-2026-08-15.md`](docs/PRODUCTION-FIXES-2026-08-15.md)
> - 实际部署配置：[`docker-compose.yml`](docker-compose.yml)
>
> 部署流程摘要：`cp .env.example .env` → 填入 `JWT_SECRET` / `API_KEY_ENCRYPTION_KEY` / `MINIMAX_API_KEY` → `docker compose up -d --build`（web/worker 自动构建，entrypoint 自动跑迁移）。
>
> 本文件仅保留弃用声明，不再描述具体部署步骤、环境变量、监控等。