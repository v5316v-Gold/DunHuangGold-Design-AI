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
./node_modules/.bin/next build

echo ""
echo "✅ 构建完成"
