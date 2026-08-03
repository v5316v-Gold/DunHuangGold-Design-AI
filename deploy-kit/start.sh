#!/bin/bash
# ========================================
# 启动服务 (macOS/Linux)
# ========================================

set -e

# 配置
SSD_MOUNT="/Volumes/MySSD"  # 修改为你的挂载点
PROJECT_DIR="$SSD_MOUNT/dunhuang-design"
PG_VERSION="17"
LOG_DIR="$PROJECT_DIR/logs"

# 检查挂载点
if [ ! -d "$SSD_MOUNT" ]; then
    echo "❌ 移动硬盘未挂载: $SSD_MOUNT"
    echo "请先挂载移动硬盘"
    exit 1
fi

if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ 部署目录不存在: $PROJECT_DIR"
    exit 1
fi

echo "========================================"
echo "   敦煌金 AI 设计平台 - 启动服务"
echo "========================================"
echo ""

# 创建日志目录
mkdir -p "$LOG_DIR"

# 启动 PostgreSQL
echo "[1/2] 启动 PostgreSQL 数据库..."

# 检测系统
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    PG_BIN="/opt/homebrew/opt/postgresql@${PG_VERSION}/bin"
else
    # Linux
    PG_BIN="/usr/pgsql-${PG_VERSION}/bin"
fi

"$PG_BIN/pg_ctl" -D "$PROJECT_DIR/postgres" -l "$LOG_DIR/pg.log" start

# 等待数据库启动
sleep 3

# 验证数据库
echo "    验证数据库连接..."
if ! "$PG_BIN/psql" -U postgres -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ 数据库启动失败，请检查日志: $LOG_DIR/pg.log"
    exit 1
fi
echo "✅ 数据库启动成功"

# 获取本机IP
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I | awk '{print $1}')

# 启动应用
echo "[2/2] 启动 Web 应用..."
cd "$PROJECT_DIR/project/workspace"

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "    首次启动，安装依赖..."
    pnpm install
fi

# 数据库迁移
if [ -f ".env.local" ]; then
    echo "    运行数据库迁移..."
    pnpm db:push > /dev/null 2>&1
fi

# 后台启动
nohup pnpm start > "$LOG_DIR/app.log" 2>&1 &
echo $! > "$LOG_DIR/app.pid"
echo "✅ Web 应用启动成功"

echo ""
echo "========================================"
echo "   服务启动成功"
echo "========================================"
echo ""
echo "📍 访问地址:"
echo "   本机: http://localhost:5000"
echo "   局域网: http://${LOCAL_IP:-localhost}:5000"
echo ""
echo "📊 管理后台: http://localhost:5000/admin"
echo ""
echo "💡 提示:"
echo "   - 停止服务: bash scripts/stop.sh"
echo "   - 查看日志: $LOG_DIR"
echo ""

# 打开浏览器
open http://localhost:5000 2>/dev/null || xdg-open http://localhost:5000 2>/dev/null || true
