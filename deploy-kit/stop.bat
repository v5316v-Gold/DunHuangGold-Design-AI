@echo off
chcp 65001 >nul

:: ========================================
:: 停止服务
:: ========================================

set SSD_DRIVE=%~d0
set PROJECT_DIR=%SSD_DRIVE%dunhuang-design
set PG_VERSION=17

echo ========================================
echo    敦煌金 AI 设计平台 - 停止服务
echo ========================================
echo.

:: 停止 Web 应用
echo [1/2] 停止 Web 应用...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Dunhuang-Server*" >nul 2>&1
echo ✅ Web 应用已停止

:: 停止 PostgreSQL
echo [2/2] 停止 PostgreSQL 数据库...
"%ProgramFiles%\PostgreSQL\%PG_VERSION%\bin\pg_ctl.exe" -D "%PROJECT_DIR%\postgres" stop

if errorlevel 1 (
    echo ⚠️  PostgreSQL 未运行或停止失败
) else (
    echo ✅ PostgreSQL 已停止
)

echo.
echo ========================================
echo    服务已停止
echo ========================================
echo.
echo 可以安全移除移动硬盘
echo.
timeout /t 3 /nobreak >nul
