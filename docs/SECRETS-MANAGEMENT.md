# 密钥保险箱 — W4

本项目使用 **三层密钥管理**,从最弱到最强:

## Tier 1: .env file (本地 / dev)

把密钥写进 `.env.local` 或 `.env`,docker compose 通过 `environment:` 或
`env_file:` 注入到容器。**适合开发与单人小团队**。

```yaml
# docker-compose.yml
services:
  web:
    env_file:
      - .env
    environment:
      JWT_SECRET: ${JWT_SECRET}
      API_KEY_ENCRYPTION_KEY: ${API_KEY_ENCRYPTION_KEY}
      MINIMAX_API_KEY: ${MINIMAX_API_KEY}
```

启动后第一次会自动跑 `scripts/seed-api-configs.ts`,把密钥 AES-256-GCM 加密后
写入 `api_config_secrets` 表,主表 `api_configs.apiKey` 字段只保留 masked。

## Tier 2: docker secrets (推荐 LAN 部署)

针对 docker swarm 或单机 compose-with-secrets-file:

```bash
echo "${JWT_SECRET}"  | docker secret create jwt_secret -
echo "${API_KEY_ENCRYPTION_KEY}" | docker secret create api_key_encryption_key -
echo "${MINIMAX_API_KEY}" | docker secret create minimax_api_key -
echo "${QWEN_API_KEY}"   | docker secret create qwen_api_key -
```

或单机:

```bash
mkdir -p ./secrets
echo "${JWT_SECRET}" > ./secrets/jwt_secret
chmod 600 ./secrets/jwt_secret
```

secret 路径在容器内默认 `/run/secrets/<name>`。`docker-entrypoint.sh` 已加
secret → env 的拷贝段落(见 03 节)。

## Tier 3: external vault (HashiCorp Vault / CyberArk)

适合大型企业。模型:

```yaml
# 1. worker / web 启动前,sidecar (vault-agent) 把 secret 写到 /run/secrets/<name>
# 2. docker-entrypoint.sh 直接读 /run/secrets/<name> 注入 process.env
# 3. process.env API 不动
```

## 三层对比

| 特性 | Tier 1 (.env) | Tier 2 (docker secret) | Tier 3 (vault) |
|------|--------------|------------------------|----------------|
| 适用规模 | dev / 单机 | 小团队 LAN | 企业多集群 |
| 写入成本 | 低 | 中(需额外创建 secret) | 高(运维) |
| 密钥落盘 | `api_config_secrets`(加密)+ `.env`(明文) | 同 Tier 1,但 `.env` 文件删除 | 仅 vault 中明文 |
| 轮转策略 | 手工 | 手工 | 自动 |
| 审计 | 无 | `docker secret ls` | vault audit log |

## API Key 防泄漏

无论使用哪一层,前端永远看不到明文:

- `GET /api/admin/api-config` 返回的 `apiKey` 字段是 masked(`****xxxx`)
- `hasKey: true|false` 用于 UI 按钮
- POST 写入时把明文转入 `api_config_secrets`,主表只留 masked
- 后端 server-side 真正解密走 `lib/api-key-resolver.ts`

## 启动期脚本

`scripts/docker-entrypoint.sh` 自动:

1. 跑迁移(013 引入 worker_nodes 等)
2. 调 `scripts/seed-api-configs.ts` 把 `.env` 灌进 DB
3. (如 `ENSURE_MINIO_BUCKET=1`)创建 MinIO bucket
4. 启动应用

如果使用 docker secrets,你需要让 entrypoint 先把 `/run/secrets/*` 复制到
`process.env`(`tee /dev/stderr` 已被 swap 成 docker stdout)。

## 旧默认值封堵(2026-08-16)

- `admin/admin123` 默认账户在新部署必须强制改密
- `JWT_SECRET` 占位字符串:启动期 fail-closed
- `API_KEY_ENCRYPTION_KEY` 缺失:seed-api-configs 退出码 1,不跳过
