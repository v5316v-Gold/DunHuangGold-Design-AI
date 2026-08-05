#!/bin/sh
# ========================================
# 容器 entrypoint（P0-1）
# ========================================
# 启动前执行数据库迁移（幂等），失败则阻断启动（防止应用连不上 schema）。
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

# 2. 执行应用启动命令
echo "[entrypoint] 启动: $@"
exec "$@"
