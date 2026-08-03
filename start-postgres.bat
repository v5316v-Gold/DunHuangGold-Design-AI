@echo off
REM PostgreSQL 启动脚本
REM 路径: F:\PostgreSQL\18\bin

echo Starting PostgreSQL...
"f:\PostgreSQL\18\bin\pg_ctl" start -D "f:\PostgreSQL\18\data" -l "f:\PostgreSQL\18\pg_log\startup.log" -w
echo PostgreSQL started on port 5432
