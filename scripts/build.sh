#!/bin/bash
# ========================================
# 构建生产版本
# ========================================
#
# 修复说明 (2026-08-03):
#   原脚本错误地调用 `pnpm build`,但 package.json#scripts.build 本身又是
#   `bash ./scripts/build.sh` —— 这会触发 无限递归 调用本脚本。
#   修复方法: 直接调用 `next build`,跳过 pnpm 包装层,避免递归。
#
#   注意: 不要改回 `pnpm build` 或 `npm run build`,否则会再次陷入循环。
# ========================================

set -e

echo "========================================"
echo "   构建生产版本"
echo "========================================"
echo ""

# 直接调用 next build，避免与 package.json#scripts.build 递归
# 使用 ./node_modules/.bin/next 是因为 PATH 中可能没有 next 命令
# (Windows + MSYS bash 环境下 npx/pnpm 命令调用经常路径穿透失败)
# 必须把 JWT_SECRET 等关键 env 显式传过去,bash build 时 worker 子进程不会自动继承
JWT_SECRET="${JWT_SECRET:-ci-test-jwt-secret-32-chars-minimum-yes}"
API_KEY_ENCRYPTION_KEY="${API_KEY_ENCRYPTION_KEY:-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef}"
DATABASE_URL="${DATABASE_URL:-postgresql://dunhuang1:dunhuang2026@localhost:5432/dunhuang}"
REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export JWT_SECRET API_KEY_ENCRYPTION_KEY DATABASE_URL REDIS_URL
./node_modules/.bin/next build

echo ""
echo "✅ 构建完成"
