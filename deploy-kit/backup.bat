@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ========================================
:: 数据库备份
:: ========================================

set SSD_DRIVE=%~d0
set PROJECT_DIR=%SSD_DRIVE%dunhuang-design
set BACKUP_DIR=%PROJECT_DIR%\backups
set PG_VERSION=17

:: 检查移动硬盘
if not exist "%PROJECT_DIR%" (
    echo ❌ 找不到部署目录
    pause
    exit /b 1
)

echo ========================================
echo    敦煌金 AI 设计平台 - 数据库备份
echo ========================================
echo.

:: 创建备份目录
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: 生成时间戳
for /f "tokens=2 delims==" %%a in ('wmic os get localdatetime /value') do set datetime=%%a
set BACKUP_FILE=%BACKUP_DIR%\dump_%datetime:~0,8%_%datetime:~8,6%.dump

:: 执行备份
echo 正在备份数据库...
"%ProgramFiles%\PostgreSQL\%PG_VERSION%\bin\pg_dump.exe" -U postgres -h 127.0.0.1 -d dunhuang_design -F c -f "%BACKUP_FILE%"

if errorlevel 1 (
    echo ❌ 备份失败
    pause
    exit /b 1
)

:: 获取备份文件大小
for %%A in ("%BACKUP_FILE%") do set SIZE=%%~zA
set /a SIZE_MB=!SIZE!/1048576

echo ✅ 备份成功
echo    文件: %BACKUP_FILE%
echo    大小: !SIZE_MB! MB

:: 清理旧备份 (保留最近7天)
echo.
echo 清理旧备份...
for /f "delims=" %%a in ('dir "%BACKUP_DIR%\dump_*.dump" /b /o-d /t:c') do (
    for /f "tokens=1-3 delims=_" %%b in ("%%a") do (
        set filedate=%%b
        for /f "tokens=1-3 delims= " %%x in ("%filedate:~0,8%") do (
            set year=%%x
            set month=%%y
            set day=%%z
        )
    )
)

:: 简单清理7天前的
forfiles /p "%BACKUP_DIR%" /m dump_*.dump /d -7 /c "cmd /c del @path" >nul 2>&1
echo ✅ 已清理7天前的备份

echo.
echo ========================================
echo    备份完成
echo ========================================
echo.
pause
