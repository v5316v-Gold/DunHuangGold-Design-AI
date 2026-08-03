@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ========================================
:: 敦煌金 AI 设计平台 - 一键部署
:: ========================================

echo.
echo ========================================
echo    敦煌金 AI 设计平台 - 部署向导
echo ========================================
echo.

:: 配置变量
set /p SSD_DRIVE="请输入移动硬盘盘符 (如 D): "
set SSD_DRIVE=%SSD_DRIVE%:\
set PROJECT_DIR=%SSD_DRIVE%dunhuang-design
set PG_VERSION=17

:: 创建目录结构
echo [1/6] 创建目录结构...
mkdir "%PROJECT_DIR%\postgres" 2>nul
mkdir "%PROJECT_DIR%\backups" 2>nul
mkdir "%PROJECT_DIR%\logs" 2>nul
mkdir "%PROJECT_DIR%\scripts" 2>nul
mkdir "%PROJECT_DIR%\project" 2>nul
echo ✅ 目录创建完成

:: 检查 PostgreSQL 安装
echo [2/6] 检查 PostgreSQL 安装...
if not exist "%ProgramFiles%\PostgreSQL\%PG_VERSION%\bin\initdb.exe" (
    echo ❌ 未检测到 PostgreSQL %PG_VERSION%
    echo.
    echo 请先安装 PostgreSQL:
    echo 1. 下载: https://www.postgresql.org/download/windows/
    echo 2. 或运行: winget install PostgreSQL.PostgreSQL
    echo.
    pause
    exit /b 1
)
echo ✅ PostgreSQL %PG_VERSION% 已安装

:: 初始化数据库
echo [3/6] 初始化 PostgreSQL 数据库...
if exist "%PROJECT_DIR%\postgres\PG_VERSION" (
    echo ⚠️  数据库已存在，跳过初始化
) else (
    set /p DB_PASSWORD="请设置 PostgreSQL 密码: "
    "%ProgramFiles%\PostgreSQL\%PG_VERSION%\bin\initdb.exe" -D "%PROJECT_DIR%\postgres" -E UTF8 -U postgres -A password -W -! DB_PASSWORD!
    if errorlevel 1 (
        echo ❌ 数据库初始化失败
        pause
        exit /b 1
    )
    echo ✅ 数据库初始化完成
)

:: 配置 PostgreSQL
echo [4/6] 配置 PostgreSQL...
(
    echo listen_addresses = '*'
    echo port = 5432
    echo max_connections = 100
    echo shared_buffers = 128MB
    echo effective_cache_size = 256MB
    echo maintenance_work_mem = 64MB
) >> "%PROJECT_DIR%\postgres\postgresql.conf"

(
    echo host    all             all             127.0.0.1/32            md5
    echo host    all             all             0.0.0.0/0               md5
) >> "%PROJECT_DIR%\postgres\pg_hba.conf"
echo ✅ 配置完成

:: 创建数据库
echo [5/6] 创建应用数据库...
"%ProgramFiles%\PostgreSQL\%PG_VERSION%\bin\pg_ctl.exe" -D "%PROJECT_DIR%\postgres" -l "%PROJECT_DIR%\logs\pg.log" start
timeout /t 3 /nobreak >nul

"%ProgramFiles%\PostgreSQL\%PG_VERSION%\bin\createdb.exe" -U postgres dunhuang_design 2>nul
if errorlevel 0 (
    echo ✅ 数据库创建成功
) else (
    echo ⚠️  数据库已存在或创建失败，请检查
)

:: 复制项目文件
echo [6/6] 复制项目文件...
if exist "%CD%" (
    xcopy "%CD%" "%PROJECT_DIR%\project\workspace" /E /I /Y /H >nul 2>&1
    echo ✅ 项目文件复制完成
) else (
    echo ⚠️  请手动将项目代码复制到: %PROJECT_DIR%\project\workspace
)

:: 创建环境变量文件
(
    echo DATABASE_URL=postgresql://postgres:!DB_PASSWORD!@127.0.0.1:5432/dunhuang_design
    echo NODE_ENV=production
    echo PORT=5000
    echo HOST=0.0.0.0
) > "%PROJECT_DIR%\project\workspace\.env.local"
echo ✅ 环境变量配置完成

:: 停止数据库
"%ProgramFiles%\PostgreSQL\%PG_VERSION%\bin\pg_ctl.exe" -D "%PROJECT_DIR%\postgres" stop

echo.
echo ========================================
echo    🎉 部署完成！
echo ========================================
echo.
echo 部署位置: %PROJECT_DIR%
echo.
echo 下一步操作:
echo 1. 双击 scripts\start.bat 启动服务
echo 2. 访问 http://localhost:5000
echo 3. 注册账号或使用管理员登录
echo.
echo 管理员账号: admin@example.com
echo 管理员密码: 请在首次登录后设置
echo.
pause
