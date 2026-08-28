#!/bin/sh
# ========================================
# Container entrypoint (P0-1: W1/R2 MinIO bucket + api_configs seed)
# ========================================
# 1. Run database migrations (idempotent) before start; block on failure
# 2. Ensure MinIO bucket exists (only when STORAGE_PROVIDER=minio)
# 3. Seed api_configs from .env (5 categories + AES-256-GCM encryption)
#
# Usage:
#   ENTRYPOINT_MIGRATE=1  default for web/worker; run migrations
#   ENTRYPOINT_MIGRATE=0  skip migrations
# ========================================

set -e

# 1. Database migration (idempotent, can re-run)
if [ "${ENTRYPOINT_MIGRATE:-1}" = "1" ]; then
  echo "[entrypoint] running database migrations..."
  node /app/scripts/migrate.js
  if [ $? -ne 0 ]; then
    echo "[entrypoint] ERROR migration failed, abort startup"
    exit 1
  fi
  echo "[entrypoint] migration OK"
else
  echo "[entrypoint] skip migrations ENTRYPOINT_MIGRATE=0"
fi

# 1.5 W4 docker secrets to env injection
# Each file under /run/secrets/<NAME> is exported as process.env.<NAME>
# Lower priority than existing process.env entries
if [ -d "/run/secrets" ]; then
  echo "[entrypoint] docker-secrets injection start"
  for f in /run/secrets/*; do
    [ -f "$f" ] || continue
    name="$(basename "$f")"
    upper="$(echo "$name" | tr '[:lower:]' '[:upper:]' | tr '-' '_')"
    # Only set if process.env has not declared
    if [ -z "$(eval echo \${$upper+x})" ]; then
      val="$(cat "$f")"
      export "$upper=$val"
      echo "[entrypoint] secrets/$name -> $upper length=${#val}"
    fi
  done
fi

# 1.6 W1 R2 seed api_configs (from .env 5 categories + encrypted)
if [ "${SEED_API_CONFIGS:-1}" = "1" ] && [ "${NODE_ENV}" != "test" ]; then
  echo "[entrypoint] seed api_configs..."
  if [ -f /app/scripts/seed-api-configs.js ] || [ -d /app/dist-scripts ]; then
    # Prefer prebuilt bundle
    if [ -f /app/scripts/seed-api-configs.js ]; then
      node /app/scripts/seed-api-configs.js || echo "[entrypoint] WARN seed-api-configs failed (non-blocking)"
    fi
  else
    echo "[entrypoint] skip seed-api-configs bundle not found"
  fi
fi

# 2. W1 R2 ensure MinIO bucket exists (only web container needs)
if [ "${ENSURE_MINIO_BUCKET:-0}" = "1" ] && [ -n "${MINIO_ENDPOINT:-}" ]; then
  echo "[entrypoint] ensure-minio-bucket on ${MINIO_ENDPOINT}/$(echo ${MINIO_BUCKET:-dunhuang-uploads})"
  if command -v mc >/dev/null 2>&1; then
    mc alias set local "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER:-dunhuang}" "${MINIO_ROOT_PASSWORD:-dunhuang2026}" >/dev/null 2>&1 || true
    mc mb --ignore-existing "local/${MINIO_BUCKET:-dunhuang-uploads}" >/dev/null 2>&1 || true
    mc anonymous set download "local/${MINIO_BUCKET:-dunhuang-uploads}" >/dev/null 2>&1 || true
    echo "[entrypoint] MinIO bucket ready"
  else
    echo "[entrypoint] skip mc not in PATH"
  fi
fi

# 3. Run application start command
echo "[entrypoint] starting: $@"
exec "$@"