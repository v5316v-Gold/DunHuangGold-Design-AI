@echo off
chcp 65001 >nul
title 敦煌金AI设计平台

echo ========================================
echo   敦煌金 AI 设计平台启动器
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] 检查 Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 23
    pause
    exit /b 1
)
node --version

echo.
echo [2/4] 检查 pnpm...
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] pnpm 未找到，正在安装...
    npm install -g pnpm@9
)
pnpm --version

echo.
echo [3/4] 检查依赖...
if not exist "node_modules" (
    echo [INFO] node_modules 不存在，正在安装依赖...
    pnpm install
)

echo.
echo [4/4] 启动开发服务器...
echo.
echo ========================================
echo   启动中... 请访问 http://localhost:3000
echo ========================================
echo.

set DATABASE_URL=postgresql://dunhuang_user:553166@localhost:5432/dunhuang
set JWT_SECRET=dev-jwt-secret-change-in-production
set NEXT_PUBLIC_APP_URL=http://localhost:3000

pnpm dev
