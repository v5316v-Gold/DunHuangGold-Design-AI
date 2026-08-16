# 敦煌金 AI · 局域网部署指南 (W4)

> 目标:**两小时内让 17 个设计 / 对话 / 视频 / 3D 功能在 LAN 上跑通**。

## 0. 前置

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 已启动(WSL2 后端)
- `192.168.x.x` 段 LAN 内的 1 台宿主机
- (可选)公网域名 + Let's Encrypt 证书
- ComfyUI 0.18+ + GPU 模型(详见 `LOCAL_AI_SETUP.md`)

## 1. 准备

```bash
git clone https://github.com/v5316v-Gold/DunHuangGold-Design-AI.git
cd DunHuangGold-Design-AI
cp .env.example .env
```

填好 `.env` 中的真实密钥:

```bash
JWT_SECRET=$(openssl rand -base64 48)
API_KEY_ENCRYPTION_KEY=$(openssl rand -hex 32)
MINIMAX_API_KEY=sk-cp-...
QWEN_API_KEY=sk-...
ZHIPU_API_KEY=...
MESHY_API_KEY=...
```

## 2. 启动依赖

```bash
# 启动 PG / Redis / MinIO
docker compose up -d postgres redis minio

# 确认 healthy
docker ps
```

## 3. 启动 web / worker(会自动跑迁移 + seed api_configs)

```bash
docker compose build web worker
docker compose up -d web worker
```

预计 5–10 分钟首次构建。

## 4. seed-comfyui-bindings(16 个 design 功能)

```bash
docker compose exec web node -e "
  const tsx = require('child_process').spawnSync;
  const p = tsx('pnpm', ['tsx', 'scripts/seed-comfyui-bindings.ts'], { encoding: 'utf8' });
  console.log(p.stdout, p.stderr);
"
```

## 5. 启动 nginx(自签证书)

```bash
bash deploy/gen-selfsigned.sh --host=$(hostname -I | awk '{print $1}') --days=365
docker compose -f deploy/nginx-docker-compose.yml up -d nginx
```

浏览器访问 `https://<host>` → 信任自签证书 → 登录页 admin@dunhuang.com / admin123
(首次登录强制改密)。

## 6. 启动 cron 备份(可选)

```bash
mkdir -p ./backups ./logs
docker compose -f deploy/cron/docker-compose.backup.yml up -d
```

## 7. 配置 ComfyUI 工作流 + 8 项门禁

这是 W4 最后阶段(目标里写明)的前置,但可分阶段:

```bash
# 1. 上传 16 个 workflow JSON
for f in assets/workflows/*.json; do
  curl -X POST -H "Authorization: Bearer \$ADMIN_JWT" \
    http://localhost:5000/api/admin/comfyui/workflows \
    -F "file=@\$f"
done

# 2. 端到端验证
pnpm tsx scripts/verify-deployment.ts --base=https://localhost
```

## 故障排查

| 现象 | 排查 |
|------|------|
| web 启动 503 数据库 | `docker logs dunhuang-postgres` 看健康 |
| nginx 502 Bad Gateway | `docker logs dunhuang-web`(端口 5000 是否起来) |
| `/api/admin/api-config` 拒绝 | 看 `auth/login` 的 `mustChangePassword` |
| ComfyUI workflow 失败 | `GET /api/admin/system` 看 comfyui.status 与队列 |
| `node dist-workers/orchestrator-worker.js` 找不到 | 容器构建时间过久 + tsup 阶段失败;`docker build --progress=plain` 看详情 |

## 更新部署

```bash
git pull
docker compose build web worker
docker compose up -d web worker
docker exec dunhuang-web node scripts/migrate.js   # 重跑迁移
docker exec dunhuang-web pnpm tsx scripts/verify-deployment.ts
```

## dev / staging

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
# 仅启动 PG / Redis / MinIO;前端用 pnpm dev 跑主机
```

## 备份恢复

```bash
# 列备份
ls backups/dunhuang_*

# 恢复
docker exec -i dunhuang-postgres pg_restore \
  -U dunhuang1 -d dunhuang --clean --if-exists < backups/dunhuang_20260816_030000/dunhuang_20260816_030000.dump

# MinIO mirror
docker exec dunhuang-minio sh -c "
  mc alias set local http://localhost:9000 dunhuang dunhuang2026 >/dev/null
  mc mirror --overwrite backups/dunhuang_*/minio_dunhuang-uploads.tar.gz/. local/dunhuang-uploads
"
```

## 安全检查

- [ ] 改 admin 默认密码
- [ ] `JWT_SECRET` 不是占位字符串
- [ ] `API_KEY_ENCRYPTION_KEY` 是 64 位 hex
- [ ] 5 大 API 配置加密入库(`/api/admin/api-config` 看 hasKey=true)
- [ ] nginx 只对 `/admin/api/` IP 白名单(本配置默认 LAN)
- [ ] 启动备份 cron
- [ ] `/admin/system` 健康 = ok,告警面板 historyEvents 有数
- [ ] Sentry DSN 配好(可选)
