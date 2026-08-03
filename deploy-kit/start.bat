@echo off
chcp 65001 >nul

:: ========================================
:: 启动服务
:: ========================================

set SSD_DRIVE=%~d0
set PROJECT_DIR=%SSD_DRIVE%dunhuang-design
set PG_VERSION=17
set LOG_DIR=%PROJECT_DIR%\logs

:: 检查移动硬盘
if not exist "%PROJECT_DIR%" (
    echo ❌ 找不到部署目录: %PROJECT_DIR%
    echo 请将移动硬盘挂载到 %SSD_DRIVE%
    pause
    exit /b 1
)

echo ========================================
echo    敦煌金 AI 设计平台 - 启动服务
echo ========================================
echo.

:: 创建日志目录
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

:: 启动 PostgreSQL
echo [1/2] 启动 PostgreSQL 数据库...
"%ProgramFiles%\PostgreSQL\%PG_VERSION%\bin\pg_ctl.exe" -D "%PROJECT_DIR%\postgres" -l "%LOG_DIR%\pg.log" start

:: 等待数据库启动
timeout /t 3 /nobreak >nul

:: 验证数据库
echo     验证数据库连接...
"%ProgramFiles%\PostgreSQL\%PG_VERSION%\bin\psql.exe" -U postgres -c "SELECT version();" >nul 2>&1
if errorlevel 1 (
    echo ❌ 数据库启动失败，请检查日志: %LOG_DIR%\pg.log
    pause
    exit /b 1
)
echo ✅ 数据库启动成功

:: 获取本机IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    for /f "tokens=1,2" %%b in ("%%a") do set LOCAL_IP=%%b
)

:: 启动应用
echo [2/2] 启动 Web 应用...
cd /d "%PROJECT_DIR%\project\workspace"

:: 检查是否需要安装依赖
if not exist "node_modules" (
    echo     首次启动，安装依赖...
    call pnpm install
)

:: 检查是否需要数据库迁移
if exist ".env.local" (
    echo     运行数据库迁移...
    call pnpm db:push >nul 2>&1
)

start "Dunhuang-Server" cmd /c "pnpm start"

echo.
echo ========================================
echo    服务启动成功
echo ========================================
echo.
echo 📍 访问地址:
echo    本机: http://localhost:5000
echo    局域网: http://%LOCAL_IP%:5000
echo.
echo 📊 管理后台: http://localhost:5000/admin
echo.
echo 💡 提示:
echo    - 停止服务请运行 scripts\stop.bat
echo    - 查看日志: %LOG_DIR%
echo.
timeout /t 5 /nobreak >nul

:: 打开浏览器
start http://localhost:5000
