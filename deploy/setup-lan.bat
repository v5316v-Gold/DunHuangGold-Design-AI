@echo off
chcp 65001 >nul
title 敦煌金 AI 设计平台 - LAN 部署

echo ========================================
echo   敦煌金 AI - 局域网部署启动器 (W4)
echo ========================================
echo.

cd /d "%~dp0\.."

echo [1/7] 检查 Docker...
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Docker,请先安装 Docker Desktop
    pause
    exit /b 1
)
docker --version

echo.
echo [2/7] 生成密钥(若未配置)...
if not exist ".env" (
    if exist ".env.example" (
        copy /Y .env.example .env >nul
        echo    已从 .env.example 复制 .env
    )
)

rem 占位 .env 自动用 openssl 写密钥(让首次部署可用)
where openssl >nul 2>&1
if %errorlevel% equ 0 (
    if exist ".env" (
        for /f "tokens=2 delims==" %%a in ('findstr /B "JWT_SECRET=" .env') do set "CUR_JWT=%%a"
        for /f "tokens=2 delims==" %%a in ('findstr /B "API_KEY_ENCRYPTION_KEY=" .env') do set "CUR_EK=%%a"
        if "!CUR_JWT!"=="" or "!CUR_JWT!"=="YOUR_JWT_SECRET_HERE" (
            echo    生成 JWT_SECRET ...
            for /f %%s in ('openssl rand -base64 48') do (
                >> .env echo JWT_SECRET=%%s
            )
        )
        if "!CUR_EK!"=="" (
            echo    生成 API_KEY_ENCRYPTION_KEY ...
            for /f %%s in ('openssl rand -hex 32') do (
                >> .env echo API_KEY_ENCRYPTION_KEY=%%s
            )
        )
    )
)

echo.
echo [3/7] 启动 PostgreSQL + Redis + MinIO ...
docker compose up -d postgres redis minio
if %errorlevel% neq 0 goto :err

echo.
echo [4/7] 等待 PG healthy ...
:wait_pg
docker exec dunhuang-postgres pg_isready -U dunhuang1 >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 3 /nobreak >nul
    goto :wait_pg
)
echo    OK

echo.
echo [5/7] 构建并启动 web / worker(自动跑迁移 + seed)...
docker compose build web worker
if %errorlevel% neq 0 goto :err
docker compose up -d web worker
if %errorlevel% neq 0 goto :err

echo.
echo [6/7] 启动 nginx(自签证书 + 反向代理 + LAN IP 白名单)...
if not exist "ssl\server.crt" (
    echo    生成自签证书 ...
    call deploy\gen-selfsigned.cmd
) else (
    echo    已存在 ssl\server.crt,跳过
)
docker compose -f deploy/nginx-docker-compose.yml up -d nginx
if %errorlevel% neq 0 goto :err

echo.
echo [7/7] 启动备份 cron ...
if not exist "backups" mkdir backups
if not exist "logs" mkdir logs
docker compose -f deploy/cron/docker-compose.backup.yml up -d
if %errorlevel% neq 0 (
    echo    [警告] 备份 cron 启动失败,继续 ...
)

echo.
echo ========================================
echo   部署完成!
echo.
echo   - Web:      http://localhost:5000
echo   - Nginx:    https://localhost
echo   - 默认账号: admin@dunhuang.com / admin123 (首次登录强制改密)
echo ========================================
echo.

:end
pause
exit /b 0

:err
echo.
echo [错误] 部署失败,请检查上方日志
pause
exit /b 1
