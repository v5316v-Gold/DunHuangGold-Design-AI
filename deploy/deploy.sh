#!/bin/bash
# 敦煌金 AI 设计平台 - 一键部署脚本
# 适用于 Ubuntu/Debian Linux

set -e

echo "=========================================="
echo "  敦煌金 AI 设计平台 - 局域网部署脚本"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目目录
PROJECT_DIR="${COZE_WORKSPACE_PATH:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$PROJECT_DIR"

echo -e "${GREEN}[1/6] 检查环境...${NC}"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}错误: 未安装 Node.js，请先安装 Node.js 20+${NC}"
    exit 1
fi
echo "Node.js 版本: $(node -v)"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}正在安装 pnpm...${NC}"
    npm install -g pnpm
fi
echo "pnpm 版本: $(pnpm -v)"

echo -e "${GREEN}[2/6] 安装依赖...${NC}"
pnpm install

echo -e "${GREEN}[3/6] 检查环境变量...${NC}"
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}警告: 未找到 .env.local 文件${NC}"
    echo "正在从 .env.example 创建..."
    cp .env.example .env.local
    echo -e "${YELLOW}请编辑 .env.local 配置必要的环境变量${NC}"
fi

echo -e "${GREEN}[4/6] 构建项目...${NC}"
pnpm build

echo -e "${GREEN}[5/6] 检查 PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}正在安装 PM2...${NC}"
    pnpm add -g pm2
fi

echo -e "${GREEN}[6/6] 启动服务...${NC}"

# 停止旧服务（如果存在）
pm2 delete dunhuang-ai 2>/dev/null || true

# 启动新服务
COZE_PROJECT_ENV=PROD pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

echo ""
echo -e "${GREEN}=========================================="
echo "  部署完成!"
echo "==========================================${NC}"
echo ""
echo "访问地址:"
echo "  - 本机: http://localhost:5000"
echo "  - 局域网: http://$(hostname -I | awk '{print $1}'):5000"
echo ""
echo "常用命令:"
echo "  - 查看状态: pm2 status"
echo "  - 查看日志: pm2 logs dunhuang-ai"
echo "  - 重启服务: pm2 restart dunhuang-ai"
echo "  - 停止服务: pm2 stop dunhuang-ai"
echo ""
echo "开机自启动:"
echo "  pm2 startup"
echo "  然后执行输出的命令"
echo ""
