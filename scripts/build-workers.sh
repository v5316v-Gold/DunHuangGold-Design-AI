#!/bin/bash
# ========================================
# 构建独立 Worker 进程（BullMQ orchestrator-worker）
# ========================================
#
# 用途：
#   将 workers/orchestrator-worker.ts 及其依赖打包为独立可运行产物，
#   供 Docker 单独部署（docker-compose 的 worker service）。
#
# 产物：
#   dist-workers/orchestrator-worker.js （自包含，含 @/ 别名解析）
#
# 用法：
#   bash scripts/build-workers.sh
#
# 验证：
#   node dist-workers/orchestrator-worker.js   # 启动后连接 Redis，消费 generation:v2
#
# 注意：
#   - 使用 tsup 打包（已在 devDependencies）
#   - 不升级任何依赖版本
# ========================================

set -e

echo "========================================"
echo " 构建 Worker 进程"
echo "========================================"
echo ""

# 1. 用 tsup 打包（解析 @/ 别名，外部化 node 内置模块）
echo "[1/3] 打包 orchestrator-worker + health-worker..."
./node_modules/.bin/tsup workers/orchestrator-worker.ts workers/health-worker.ts \
  --format cjs \
  --platform node \
  --target node20 \
  --out-dir dist-workers \
  --clean \
  --sourcemap \
  --external pg \
  --external bcryptjs \
  --external ioredis

echo ""
echo "[2/3] 验证产物..."
for f in orchestrator-worker health-worker; do
  if [ -f "dist-workers/$f.js" ]; then
    SIZE=$(wc -c < dist-workers/$f.js)
    echo "  ✅ dist-workers/$f.js (${SIZE} bytes)"
  else
    echo "  ❌ dist-workers/$f.js 未生成"
    exit 1
  fi
done

echo ""
echo "[3/3] 语法校验（node --check）..."
node --check dist-workers/orchestrator-worker.js
node --check dist-workers/health-worker.js
echo "  ✅ 语法正确"

echo ""
echo "========================================"
echo "✅ Worker 构建完成"
echo "  启动: node dist-workers/orchestrator-worker.js"
echo "========================================"
