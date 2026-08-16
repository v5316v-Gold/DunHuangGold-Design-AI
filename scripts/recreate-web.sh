#!/bin/bash
# 启动新 web 容器（用 docker run,保留原 env/network/healthcheck）
set -e

docker stop dunhuang-web 2>/dev/null || true
docker rm dunhuang-web 2>/dev/null || true

docker run -d --name dunhuang-web --network dunhuang-net -p 5000:5000 --restart on-failure:3 \
  -e "HOSTNAME=0.0.0.0" \
  -e "NODE_ENV=production" \
  -e "PORT=5000" \
  -e "DATABASE_URL=postgresql://dunhuang1:dunhuang2026@postgres:5432/dunhuang" \
  -e "REDIS_URL=redis://redis:6379" \
  -e "JWT_SECRET=8UMX1qCnCtNmFwfx1h5nADQcKf3lKu+lAfGMOm2rItM=" \
  -e "API_KEY_ENCRYPTION_KEY=" \
  -e "MINIMAX_API_KEY=sk-cp-3XKlkHl-9DmvB0bI-Vh4oYMSr740BPV3L-BpHOm-CTpUDEew_KyDmRL1A6iPexdSacZ722G7g9Umn8LksT09QYRT6N0NxAfS0ZP3YWKSQ_wOpBb0wJR-gT4" \
  -e "COMFYUI_HOST=http://host.docker.internal:8188" \
  -e "NEXT_PUBLIC_APP_URL=http://localhost:5000" \
  -e "ALLOWED_ORIGIN=http://localhost:5000" \
  -e "STORAGE_PROVIDER=local" \
  -e "UPLOAD_DIR=/app/uploads" \
  -e "ENTRYPOINT_MIGRATE=1" \
  -e "RUN_SEED=0" \
  -e "ALLOW_MOCK_IN_PRODUCTION=true" \
  --health-cmd 'node -e "require(\"http\").get(\"http://localhost:5000/api/ping\", r => process.exit(r.statusCode === 200 ? 0 : 1)).on(\"error\", () => process.exit(1))"' \
  --health-interval 30s --health-timeout 10s --health-start-period 60s --health-retries 5 \
  dunhuang-web:new

echo "web container started"
