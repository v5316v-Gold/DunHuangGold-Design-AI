@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ========================================
:: 敦煌金 AI 设计平台 - F盘自动安装
:: ========================================

echo.
echo ========================================
echo    敦煌金 AI 设计平台 - 自动部署
echo    目标驱动器: F:
echo ========================================
echo.

:: 检查F盘是否存在
if not exist "F:\" (
    echo ❌ F盘不存在！
    echo 请确保移动硬盘已插入并挂载为F盘
    pause
    exit /b 1
)

:: 检查F盘可用空间
for /f "tokens=3" %%a in ('fsutil volume diskfree F: ^| find "可用字节数"') do set FREE_BYTES=%%a
set /a FREE_GB=%FREE_BYTES% / 1073741824

echo ✅ F盘已检测，可用空间: %FREE_GB% GB

if %FREE_GB% LSS 50 (
    echo ⚠️  警告: 可用空间少于50GB，建议至少100GB
    pause
)

:: 配置变量
set PROJECT_DIR=F:\dunhuang-design
set PG_VERSION=17
set PG_PATH=C:\Program Files\PostgreSQL\%PG_VERSION%
set PG_BIN=%PG_PATH%\bin

:: 步骤1: 检查PostgreSQL
echo.
echo [1/7] 检查 PostgreSQL 安装...

if not exist "%PG_BIN%\initdb.exe" (
    echo ❌ 未检测到 PostgreSQL %PG_VERSION%
    echo.
    echo 请先安装 PostgreSQL:
    echo 方法1: winget install PostgreSQL.PostgreSQL
    echo 方法2: 下载 https://www.postgresql.org/download/windows/
    echo.
    pause
    exit /b 1
)

echo ✅ PostgreSQL %PG_VERSION% 已安装: %PG_PATH%

:: 步骤2: 创建目录结构
echo.
echo [2/7] 创建目录结构...

mkdir "%PROJECT_DIR%\postgres" 2>nul
mkdir "%PROJECT_DIR%\backups" 2>nul
mkdir "%PROJECT_DIR%\logs" 2>nul
mkdir "%PROJECT_DIR%\scripts" 2>nul
mkdir "%PROJECT_DIR%\project" 2>nul

echo ✅ 目录结构已创建: %PROJECT_DIR%

:: 步骤3: 检查是否已初始化
echo.
echo [3/7] 初始化 PostgreSQL 数据库...

if exist "%PROJECT_DIR%\postgres\PG_VERSION" (
    echo ⚠️  数据库已存在，跳过初始化
    goto skip_init
)

:: 设置密码
echo.
echo 请设置 PostgreSQL 数据库密码（请记住此密码！）
set /p DB_PASSWORD="数据库密码: "

:: 初始化数据库
echo 正在初始化数据库...
"%PG_BIN%\initdb.exe" -D "%PROJECT_DIR%\postgres" -E UTF8 -U postgres -A password -W --pwfile= >nul 2>&1

:: 使用临时文件传递密码
(echo !DB_PASSWORD!) > "%TEMP%\pg_pass.txt"
"%PG_BIN%\initdb.exe" -D "%PROJECT_DIR%\postgres" -E UTF8 -U postgres -A password --pwfile="%TEMP%\pg_pass.txt"
del "%TEMP%\pg_pass.txt"

if errorlevel 1 (
    echo ❌ 数据库初始化失败
    echo 请检查日志: %PROJECT_DIR%\logs\init.log
    pause
    exit /b 1
)

echo ✅ 数据库初始化成功

:skip_init

:: 步骤4: 配置PostgreSQL
echo.
echo [4/7] 配置 PostgreSQL...

:: 创建或更新 postgresql.conf
(
    echo # ========================================
    echo # 敦煌金设计平台 - PostgreSQL 配置
    echo # ========================================
    echo.
    echo listen_addresses = '*'
    echo port = 5432
    echo max_connections = 100
    echo shared_buffers = 128MB
    echo effective_cache_size = 256MB
    echo maintenance_work_mem = 64MB
    echo checkpoint_completion_target = 0.9
    echo wal_buffers = 16MB
    echo default_statistics_target = 100
    echo random_page_cost = 1.1
    echo effective_io_concurrency = 200
    echo work_mem = 1310kB
    echo min_wal_size = 1GB
    echo max_wal_size = 4GB
) > "%PROJECT_DIR%\postgres\postgresql.conf"

:: 创建或更新 pg_hba.conf
(
    echo # ========================================
    echo # 访问控制配置
    echo # ========================================
    echo.
    echo TYPE  DATABASE    USER        ADDRESS            METHOD
    echo.
    echo # 允许本地连接
    echo host    all             all             127.0.0.1/32            md5
    echo host    all             all             ::1/128                 md5
    echo.
    echo # 允许局域网连接（可选，注释掉以提高安全性）
    echo host    all             all             0.0.0.0/0               md5
) > "%PROJECT_DIR%\postgres\pg_hba.conf"

echo ✅ 配置文件已更新

:: 步骤5: 启动PostgreSQL并创建数据库
echo.
echo [5/7] 启动 PostgreSQL 数据库...

"%PG_BIN%\pg_ctl.exe" -D "%PROJECT_DIR%\postgres" -l "%PROJECT_DIR%\logs\pg.log" start

if errorlevel 1 (
    echo ❌ PostgreSQL 启动失败
    echo 查看日志: %PROJECT_DIR%\logs\pg.log
    pause
    exit /b 1
)

timeout /t 3 /nobreak >nul

echo ✅ PostgreSQL 已启动

:: 创建数据库
echo 创建应用数据库...
"%PG_BIN%\createdb.exe" -U postgres dunhuang_design 2>nul

if errorlevel 0 (
    echo ✅ 数据库创建成功
) else (
    echo ⚠️  数据库已存在或创建失败
)

:: 步骤6: 复制部署脚本
echo.
echo [6/7] 复制部署脚本到F盘...

:: 这里假设脚本从当前目录运行，复制到F盘
if exist "%~dp0start.bat" (
    copy "%~dp0start.bat" "%PROJECT_DIR%\scripts\" /Y >nul
    copy "%~dp0stop.bat" "%PROJECT_DIR%\scripts\" /Y >nul
    copy "%~dp0backup.bat" "%PROJECT_DIR%\scripts\" /Y >nul
    copy "%~dp0restore.bat" "%PROJECT_DIR%\scripts\" /Y >nul
    echo ✅ 管理脚本已复制
)

:: 步骤7: 生成环境变量配置文件
echo.
echo [7/7] 生成应用配置文件...

:: 读取或提示输入数据库密码
if not defined DB_PASSWORD (
    set /p DB_PASSWORD="请输入 PostgreSQL 数据库密码: "
)

:: 创建 .env.local 文件
set ENV_FILE=%PROJECT_DIR%\project\.env.local

(
    echo # ========================================
    echo # 敦煌金 AI 设计平台 - 环境变量
    echo # ========================================
    echo.
    echo # 数据库配置
    echo DATABASE_URL=postgresql://postgres:!DB_PASSWORD!@127.0.0.1:5432/dunhuang_design
    echo.
    echo # 应用配置
    echo NODE_ENV=production
    echo PORT=5000
    echo HOST=0.0.0.0
    echo.
    echo # Supabase配置（可选，用于文件存储）
    echo # SUPABASE_URL=https://xxx.supabase.co
    echo # SUPABASE_ANON_KEY=your_key_here
    echo.
) > "%ENV_FILE%"

echo ✅ 配置文件已创建: %ENV_FILE%

:: 显示部署信息
echo.
echo ========================================
echo    🎉 部署完成！
echo ========================================
echo.
echo 📂 部署位置: F:\dunhuang-design
echo.
echo 📋 目录结构:
echo     F:\dunhuang-design\
echo     ├── postgres\          # PostgreSQL 数据
echo     ├── backups\           # 备份文件
echo     ├── logs\              # 日志文件
echo     ├── scripts\           # 管理脚本
echo     └── project\           # 项目代码
echo.
echo 🔑 数据库配置:
echo     主机: 127.0.0.1
echo     端口: 5432
echo     数据库: dunhuang_design
echo     用户: postgres
echo     密码: [已设置]
echo.
echo 📝 下一步操作:
echo.
echo 1. 将项目代码复制到 F:\dunhuang-design\project\
echo.
echo 2. 进入项目目录并运行迁移:
echo    cd F:\dunhuang-design\project\workspace\projects
echo    pnpm db:push
echo.
echo 3. 启动服务:
echo    F:\dunhuang-design\scripts\start.bat
echo.
echo 4. 访问应用:
echo    http://localhost:5000
echo.
echo 💡 管理员账号:
echo    邮箱: admin@example.com
echo    密码: 首次登录后设置
echo.
echo ========================================
echo.

pause
