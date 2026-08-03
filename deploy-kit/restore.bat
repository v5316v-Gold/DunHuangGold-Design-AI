@echo off
chcp 65001 >nul

:: ========================================
:: 数据库恢复
:: ========================================

set SSD_DRIVE=%~d0
set PROJECT_DIR=%SSD_DRIVE%dunhuang-design
set BACKUP_DIR=%PROJECT_DIR%\backups
set PG_VERSION=17

echo ========================================
echo    敦煌金 AI 设计平台 - 数据库恢复
echo ========================================
echo.

:: 列出可用备份
echo 可用的备份文件:
echo.
set count=0
for /f "delims=" %%a in ('dir "%BACKUP_DIR%\dump_*.dump" /b /o-d /t:c') do (
    set /a count+=1
    echo [!count!] %%a
    set backup_!count!=%%a
)

if %count%==0 (
    echo ❌ 没有可用的备份文件
    pause
    exit /b 1
)

echo.
set /p choice="请选择备份文件编号 (1-%count%): "

:: 获取选择的文件
set selected_backup=
for /l %%i in (1,1,%count%) do (
    if !choice!==%%i set selected_backup=!backup_%%i!
)

if "%selected_backup%"=="" (
    echo ❌ 无效的选择
    pause
    exit /b 1
)

echo.
echo 确认恢复备份: %selected_backup%
echo ⚠️  警告: 这将覆盖当前数据库！
set /p confirm="确认继续? (yes/no): "

if /i not "%confirm%"=="yes" (
    echo 取消恢复
    pause
    exit /b 0
)

:: 停止数据库连接
echo.
echo [1/3] 停止应用服务...
taskkill /F /IM node.exe /FI "WINDOWTITLE eq Dunhuang-Server*" >nul 2>&1

:: 删除现有数据库
echo [2/3] 删除现有数据库...
"%ProgramFiles%\PostgreSQL\%PG_VERSION%\bin\dropdb.exe" -U postgres -h 127.0.0.1 dunhuang_design
"%ProgramFiles%\PostgreSQL\%PG_VERSION%\bin\createdb.exe" -U postgres -h 127.0.0.1 dunhuang_design

:: 恢复备份
echo [3/3] 恢复数据...
"%ProgramFiles%\PostgreSQL\%PG_VERSION%\bin\pg_restore.exe" -U postgres -h 127.0.0.1 -d dunhuang_design -F c "%BACKUP_DIR%\%selected_backup%"

if errorlevel 1 (
    echo ❌ 恢复失败
    pause
    exit /b 1
)

echo.
echo ✅ 恢复成功
echo.
echo 请运行 start.bat 启动服务
echo.
pause
