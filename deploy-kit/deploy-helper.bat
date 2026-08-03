@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ========================================
:: 敦煌金 AI 设计平台 - 部署助手
:: 自动检查环境和指导部署
:: ========================================

title 敦煌金 AI 设计平台 - 部署助手
color 0A

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  敦煌金 AI 设计平台 - 智能部署助手                         ║
echo ║  自动检查环境并指导部署                                   ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

:: 步骤1：检查管理员权限
echo [1/7] 检查管理员权限...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ 请右键以管理员身份运行此脚本
    echo.
    pause
    exit /b 1
)
echo ✅ 管理员权限确认

:: 步骤2：检查F盘
echo.
echo [2/7] 检查 F 盘...
if not exist "F:\" (
    echo ❌ F盘不存在！
    echo.
    echo 请确保：
    echo 1. 移动硬盘已插入
    echo 2. 显示为 F: 盘符
    echo.
    echo 当前可用盘符：
    wmic logicaldisk get name,volumename
    echo.
    set /p cont="按回车退出，插入F盘后重新运行..."
    exit /b 1
)
echo ✅ F盘已检测

:: 检查F盘空间
for /f "tokens=3" %%a in ('fsutil volume diskfree F: ^| find "可用字节数"') do set FREE_BYTES=%%a
set /a FREE_GB=%FREE_BYTES% / 1073741824
echo    可用空间: %FREE_GB% GB

if %FREE_GB% LSS 50 (
    echo ⚠️  警告: 可用空间少于50GB，建议至少100GB
    echo.
)

:: 步骤3：检查PostgreSQL
echo.
echo [3/7] 检查 PostgreSQL 安装...
if not exist "C:\Program Files\PostgreSQL\17\bin\psql.exe" (
    echo ❌ 未检测到 PostgreSQL 17
    echo.
    echo 请选择安装方式：
    echo.
    echo [1] 使用 winget 自动安装（推荐）
    echo [2] 手动下载安装
    echo [3] 跳过，已安装到其他位置
    echo.
    set /p choice="请选择 [1/2/3]: "

    if "%choice%"=="1" (
        echo.
        echo 正在安装 PostgreSQL...
        winget install PostgreSQL.PostgreSQL --accept-package-agreements --accept-source-agreements
        echo.
        echo ✅ 安装完成，请重启电脑后重新运行此脚本
        pause
        exit /b 0
    ) else if "%choice%"=="2" (
        echo.
        echo 请访问以下链接下载 PostgreSQL 17：
        echo https://www.postgresql.org/download/windows/
        echo.
        start https://www.postgresql.org/download/windows/
        echo.
        echo 安装完成后重启电脑，重新运行此脚本
        pause
        exit /b 0
    ) else if "%choice%"=="3" (
        set /p PG_PATH="请输入 PostgreSQL 安装路径（如 C:\Program Files\PostgreSQL\17）: "
        if not exist "!PG_PATH!\bin\psql.exe" (
            echo ❌ 路径无效
            pause
            exit /b 1
        )
    )
) else (
    echo ✅ PostgreSQL 17 已安装
    set PG_PATH=C:\Program Files\PostgreSQL\17
)

:: 步骤4：检查Node.js
echo.
echo [4/7] 检查 Node.js...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Node.js 未安装
    echo.
    echo 请访问以下链接下载安装 Node.js：
    echo https://nodejs.org/
    echo.
    start https://nodejs.org/
    echo.
    echo 安装后请重新运行此脚本
    pause
    exit /b 1
)

for /f "tokens=1" %%v in ('node --version') do set NODE_VER=%%v
echo ✅ Node.js 已安装: %NODE_VER%

:: 检查pnpm
where pnpm >nul 2>&1
if %errorLevel% neq 0 (
    echo ⚠️  pnpm 未安装，正在安装...
    npm install -g pnpm
    if errorlevel 1 (
        echo ❌ pnpm 安装失败
        pause
        exit /b 1
    )
    echo ✅ pnpm 安装完成
) else (
    echo ✅ pnpm 已安装
)

:: 步骤5：创建部署目录
echo.
echo [5/7] 创建部署目录...

set PROJECT_DIR=F:\dunhuang-design
mkdir "%PROJECT_DIR%\postgres" 2>nul
mkdir "%PROJECT_DIR%\backups" 2>nul
mkdir "%PROJECT_DIR%\logs" 2>nul
mkdir "%PROJECT_DIR%\scripts" 2>nul
mkdir "%PROJECT_DIR%\project" 2>nul

echo ✅ 目录结构已创建

:: 复制脚本文件
if exist "%~dp0start.bat" (
    copy "%~dp0start.bat" "%PROJECT_DIR%\scripts\" /Y >nul 2>&1
    copy "%~dp0stop.bat" "%PROJECT_DIR%\scripts\" /Y >nul 2>&1
    copy "%~dp0backup.bat" "%PROJECT_DIR%\scripts\" /Y >nul 2>&1
    copy "%~dp0restore.bat" "%PROJECT_DIR%\scripts\" /Y >nul 2>&1
    echo ✅ 管理脚本已复制
)

:: 步骤6：初始化数据库
echo.
echo [6/7] 初始化 PostgreSQL 数据库...

if exist "%PROJECT_DIR%\postgres\PG_VERSION" (
    echo ⚠️  数据库已存在，跳过初始化
    goto skip_init
)

echo.
echo 请设置 PostgreSQL 数据库密码（请记住此密码！）
set /p DB_PASSWORD="数据库密码（至少8位）: "

if !DB_PASSWORD! LSS 8 (
    echo ❌ 密码太短，至少8位
    pause
    exit /b 1
)

echo 正在初始化数据库...
"%PG_PATH%\bin\initdb.exe" -D "%PROJECT_DIR%\postgres" -E UTF8 -U postgres -A password --pwfile="%TEMP%\pg_pass.txt" >nul 2>&1
(echo !DB_PASSWORD!) > "%TEMP%\pg_pass.txt"
"%PG_PATH%\bin\initdb.exe" -D "%PROJECT_DIR%\postgres" -E UTF8 -U postgres -A password --pwfile="%TEMP%\pg_pass.txt"
del "%TEMP%\pg_pass.txt"

if errorlevel 1 (
    echo ❌ 数据库初始化失败
    pause
    exit /b 1
)

echo ✅ 数据库初始化成功

:skip_init

:: 步骤7：配置PostgreSQL
echo.
echo 配置 PostgreSQL...

(
    echo # 敦煌金设计平台 - PostgreSQL 配置
    echo listen_addresses = '*'
    echo port = 5432
    echo max_connections = 100
    echo shared_buffers = 128MB
) > "%PROJECT_DIR%\postgres\postgresql.conf"

(
    echo # 访问控制配置
    echo host    all             all             127.0.0.1/32            md5
    echo host    all             all             0.0.0.0/0               md5
) > "%PROJECT_DIR%\postgres\pg_hba.conf"

echo ✅ 配置完成

:: 启动PostgreSQL
echo.
echo 启动 PostgreSQL 数据库...
"%PG_PATH%\bin\pg_ctl.exe" -D "%PROJECT_DIR%\postgres" -l "%PROJECT_DIR%\logs\pg.log" start

if errorlevel 1 (
    echo ⚠️  PostgreSQL 可能已在运行
) else (
    echo ✅ PostgreSQL 已启动
    timeout /t 3 /nobreak >nul
)

:: 创建数据库
echo 创建应用数据库...
"%PG_PATH%\bin\createdb.exe" -U postgres dunhuang_design 2>nul

if errorlevel 0 (
    echo ✅ 数据库创建成功
) else (
    echo ⚠️  数据库可能已存在
)

:: 生成环境变量
if not defined DB_PASSWORD (
    set /p DB_PASSWORD="请输入数据库密码: "
)

set ENV_FILE=%PROJECT_DIR%\project\.env.local

(
    echo DATABASE_URL=postgresql://postgres:!DB_PASSWORD!@127.0.0.1:5432/dunhuang_design
    echo NODE_ENV=production
    echo PORT=5000
    echo HOST=0.0.0.0
) > "%ENV_FILE%"

echo ✅ 环境变量配置完成

:: 显示部署信息
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║              🎉 环境准备完成！                            ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 📂 部署位置: F:\dunhuang-design
echo.
echo 🔑 数据库信息:
echo    主机: 127.0.0.1
echo    端口: 5432
echo    数据库: dunhuang_design
echo    用户: postgres
echo    密码: [已设置]
echo.
echo 📝 下一步操作:
echo.
echo 1. 复制项目代码到 F:\dunhuang-design\project\workspace\projects\
echo.
echo 2. 在项目目录运行以下命令:
echo    cd F:\dunhuang-design\project\workspace\projects
echo    pnpm install
echo    pnpm db:push
echo.
echo 3. 启动服务:
echo    F:\dunhuang-design\scripts\start.bat
echo.
echo 4. 访问应用:
echo    http://localhost:5000
echo.
echo ════════════════════════════════════════════════════════════
echo.
echo 是否继续复制项目代码？
echo.
set /p cont="输入 'y' 继续，或按回车退出 [y/N]: "

if /i "%cont%"=="y" (
    set /p SOURCE_PATH="请输入项目源代码路径: "

    if exist "%SOURCE_PATH%" (
        echo.
        echo 正在复制项目代码...
        if not exist "%PROJECT_DIR%\project\workspace" mkdir "%PROJECT_DIR%\project\workspace"
        xcopy "%SOURCE_PATH%" "%PROJECT_DIR%\project\workspace\projects\" /E /I /Y

        if errorlevel 1 (
            echo ❌ 复制失败
        ) else (
            echo ✅ 项目代码复制完成
            echo.
            echo 现在运行以下命令:
            echo cd F:\dunhuang-design\project\workspace\projects
            echo pnpm install
            echo pnpm db:push
            echo pnpm start
        )
    ) else (
        echo ❌ 路径不存在: %SOURCE_PATH%
    )
)

echo.
echo 部署助手已完成！
echo.
pause
