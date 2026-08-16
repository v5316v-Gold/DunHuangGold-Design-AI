#!/bin/sh
# ========================================
# 容器 entrypoint（P0-1）+ W1·R2（MinIO bucket + api_configs seed）
# ========================================
# 启动前执行数据库迁移（幂等），失败则阻断启动（防止应用连不上 schema）。
# 启动前自动确保 MinIO bucket 存在（被 STORAGE_PROVIDER=minio 启用时）。
# 启动前自动 seed api_configs（从 .env 灌 5 大类别 + AES-256-GCM 加密）。
#
# 用法：
#   ENTRYPOINT_MIGRATE=1 时执行迁移（web/worker 默认开启）
#   ENTRYPOINT_MIGRATE=0 可跳过（如只跑健康检查的临时容器）
# ========================================

set -e

# 1. 数据库迁移（幂等，可重跑）
if [ "${ENTRYPOINT_MIGRATE:-1}" = "1" ]; then
  echo "[entrypoint] 执行数据库迁移..."
  node /app/scripts/migrate.js
  if [ $? -ne 0 ]; then
    echo "[entrypoint] ❌ 迁移失败，阻断启动"
    exit 1
  fi
  echo "[entrypoint] ✅ 迁移完成"
else
  echo "[entrypoint] 跳过迁移（ENTRYPOINT_MIGRATE=0）"
fi

# 1.5 W4·docker secrets → env 注入
# 容器内 /run/secrets/<NAME> 文件单行内容 → 导出为 process.env.<NAME>
# 优先级:已有的 process.env > /run/secrets/<name>
if [ -d "/run/secrets" ]; then
  echo "[entrypoint] docker-secrets 注入开始"
  for f in /run/secrets/*; do
    [ -f "$f" ] || continue
    name="$(basename "$f")"
    upper="$(echo "$name" | tr '[:lower:]' '[:upper:]' | tr '-' '_')"
    # 仅当 process.env 中未声明时,才覆盖
    if [ -z "$(eval echo \${$upper+x})" ]; then
      val="$(cat "$f")"
      export "$upper=$val"
      echo "[entrypoint]   secrets/$name -> $upper (length=${#val})"
    fi
  done
fi

# 1.6 W1·R2·seed api_configs(从 .env 灌 5 大类别 + 加密)
if [ "${SEED_API_CONFIGS:-1}" = "1" ] && [ "${NODE_ENV}" != "test" ]; then
  echo "[entrypoint] seed api_configs..."
  if [ -f /app/scripts/seed-api-configs.js ] || [ -d /app/dist-scripts ]; then
    # 优先跑预编译产物
    if [ -f /app/scripts/seed-api-configs.js ]; then
      node /app/scripts/seed-api-configs.js || echo "[entrypoint] ⚠️ seed-api-configs 失败（非阻塞）"
    fi
  else
    echo "[entrypoint] (跳过) 未发现 seed-api-configs 预编译产物"
  fi
fi

# 2. W1·R2·确保 MinIO bucket 存在（仅 web 容器需要）
if [ "${ENSURE_MINIO_BUCKET:-0}" = "1" ] && [ -n "${MINIO_ENDPOINT:-}" ]; then
  echo "[entrypoint] ensure-minio-bucket on ${MINIO_ENDPOINT}/$(echo ${MINIO_BUCKET:-dunhuang-uploads})"
  if command -v mc >/dev/null 2>&1; then
    mc alias set local "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER:-dunhuang}" "${MINIO_ROOT_PASSWORD:-dunhuang2026}" >/dev/null 2>&1 || true
    mc mb --ignore-existing "local/${MINIO_BUCKET:-dunhuang-uploads}" >/dev/null 2>&1 || true
    mc anonymous set download "local/${MINIO_BUCKET:-dunhuang-uploads}" >/dev/null 2>&1 || true
    echo "[entrypoint] ✅ MinIO bucket ready"
  else
    echo "[entrypoint] (跳过) mc 不在 PATH"
  fi
fi

# 3. 执行应用启动命令
echo "[entrypoint] 启动: $@"
exec "$@"
