#!/bin/bash
# ========================================
# 停止服务 (macOS/Linux)
# ========================================

# 配置
SSD_MOUNT="/Volumes/MySSD"
PROJECT_DIR="$SSD_MOUNT/dunhuang-design"
PG_VERSION="17"
LOG_DIR="$PROJECT_DIR/logs"

echo "========================================"
echo "   敦煌�?AI 设计平台 - 停止服务"
echo "========================================"
echo ""

# 停止 Web 应用
echo "[1/2] 停止 Web 应用..."
if [ -f "$LOG_DIR/app.pid" ]; then
    PID=$(cat "$LOG_DIR/app.pid")
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        rm "$LOG_DIR/app.pid"
        echo "�?Web 应用已停�?
    else
        echo "⚠️  Web 应用未运�?
    fi
else
    # 尝试查找进程
    pkill -f "pnpm start" 2>/dev/null && echo "�?Web 应用已停�?
fi

# 停止 PostgreSQL
echo "[2/2] 停止 PostgreSQL 数据�?.."

# 检测系�?
if [[ "$OSTYPE" == "darwin"* ]]; then
    PG_BIN="/opt/homebrew/opt/postgresql@${PG_VERSION}/bin"
else
    PG_BIN="/usr/pgsql-${PG_VERSION}/bin"
fi

if "$PG_BIN/pg_ctl" -D "$PROJECT_DIR/postgres" stop > /dev/null 2>&1; then
    echo "�?PostgreSQL 已停�?
else
    echo "⚠️  PostgreSQL 未运行或停止失败"
fi

echo ""
echo "========================================"
echo "   服务已停�?
echo "========================================"
echo ""
echo "可以安全移除移动硬盘"
echo ""
