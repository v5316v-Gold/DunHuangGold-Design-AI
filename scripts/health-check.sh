#!/bin/bash
# ================================================
# 敦煌�?AI 设计平台 - 部署健康检查脚�?
# 用法: bash scripts/health-check.sh
# =============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# 图标
CHECK="${GREEN}�?{NC}"
CROSS="${RED}�?{NC}"
WARN="${YELLOW}�?{NC}"
INFO="${BLUE}�?{NC}"

# 计数�?
PASS=0
FAIL=0
WARN_COUNT=0

# 项目根目�?
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

print_header() {
    echo ""
    echo -e "${BOLD}${BLUE}══════════════════════════════════════════════════════�?{NC}"
    echo -e "${BOLD}${BLUE}  敦煌�?AI 设计平台 - 部署健康检�?{NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════�?{NC}"
    echo ""
}

print_section() {
    echo ""
    echo -e "${BOLD}${YELLOW}━━�?$1 ━━�?{NC}"
    echo ""
}

check_pass() {
    echo -e "${CHECK} $1"
    ((PASS++)) || true
}

check_fail() {
    echo -e "${CROSS} ${RED}$1${NC}"
    ((FAIL++)) || true
}

check_warn() {
    echo -e "${WARN} $1"
    ((WARN_COUNT++)) || true
}

check_info() {
    echo -e "${INFO} $1"
}

# ================================================
# 1. 环境检�?
# ================================================
print_section "1. 环境检�?

# Node.js 版本
NODE_VERSION=$(node -v 2>/dev/null || echo "未安�?)
REQUIRED_NODE="20.0.0"
if [[ "$NODE_VERSION" != "未安�? ]]; then
    if [[ "$(printf '%s\n' "$REQUIRED_NODE" "$NODE_VERSION" | sort -V | head -n1)" == "$REQUIRED_NODE" ]]; then
        check_pass "Node.js 版本: $NODE_VERSION (要求 >= 18.0.0)"
    else
        check_fail "Node.js 版本过低: $NODE_VERSION (要求 >= 18.0.0)"
    fi
else
    check_fail "Node.js 未安�?
fi

# pnpm
if command -v pnpm &> /dev/null; then
    PNPM_VERSION=$(pnpm -v)
    check_pass "pnpm 版本: $PNPM_VERSION"
else
    check_fail "pnpm 未安�?(运行: npm install -g pnpm)"
fi

# TypeScript
if command -v tsc &> /dev/null; then
    check_pass "TypeScript 可用"
else
    check_warn "TypeScript 未全局安装 (但项目依赖包�?"
fi

# ================================================
# 2. 文件检�?
# ================================================
print_section "2. 关键文件检�?

# .env 文件
if [ -f "$PROJECT_ROOT/.env" ]; then
    check_pass ".env 文件存在"
elif [ -f "$PROJECT_ROOT/.env.example" ]; then
    check_warn ".env 文件不存在，�?.env.example 存在"
else
    check_fail ".env 文件不存�?
fi

if [ -f "$PROJECT_ROOT/.env.local" ]; then
    check_pass ".env.local 文件存在"
else
    check_warn ".env.local 文件不存�?(开发环境可�?"
fi

# 关键配置文件
for file in "package.json" "tsconfig.json" "next.config.ts" "drizzle.config.ts"; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        check_pass "$file 存在"
    else
        check_fail "$file 缺失"
    fi
done

# ================================================
# 3. 环境变量检�?
# ================================================
print_section "3. 环境变量检�?

# 加载 .env 文件（如果存在）
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(cat "$PROJECT_ROOT/.env" | grep -v '^#' | xargs)
fi

if [ -f "$PROJECT_ROOT/.env.local" ]; then
    export $(cat "$PROJECT_ROOT/.env.local" | grep -v '^#' | xargs)
fi

# 必须的变�?
REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET")
OPTIONAL_VARS=("REDIS_URL" "NEXT_PUBLIC_APP_URL")

for var in "${REQUIRED_VARS[@]}"; do
    if [ -n "${!var}" ]; then
        if [[ "${!var}" == *"YOUR_"* ]] || [[ "${!var}" == *"example"* ]]; then
            check_warn "$var 未配置真实�?
        else
            check_pass "$var 已配�?
        fi
    else
        check_fail "$var 环境变量未设�?
    fi
done

for var in "${OPTIONAL_VARS[@]}"; do
    if [ -n "${!var}" ]; then
        check_info "$var = ${!var:0:20}..."
    else
        check_warn "$var 未设�?(可�?"
    fi
done

# ================================================
# 4. 数据库检�?
# ================================================
print_section "4. 数据库连接检�?

if [ -n "$DATABASE_URL" ]; then
    # 提取主机和端�?
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^/]*\)/.*|\1|p')
    DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
    
    if [[ "$DB_HOST" == *"localhost"* ]] || [[ "$DB_HOST" == *"127.0.0.1"* ]]; then
        # 本地数据�?- 检查服�?
        if command -v psql &> /dev/null; then
            if pg_isready -h "${DB_HOST%%:*}" -p "${DB_HOST##*:}" &> /dev/null; then
                check_pass "PostgreSQL 服务运行�?($DB_HOST)"
            else
                check_warn "PostgreSQL 服务未响�?(可能需要启�?"
            fi
        else
            check_info "psql 未安装，跳过数据库连通性检�?
        fi
    else
        check_info "远程数据�? $DB_HOST"
    fi
else
    check_fail "DATABASE_URL 未配�?
fi

# ================================================
# 5. TypeScript 编译检�?
# ================================================
print_section "5. TypeScript 编译检�?

if [ -f "$PROJECT_ROOT/node_modules/.bin/tsc" ]; then
    echo -e "${INFO} 运行 TypeScript 类型检�?.."
    if npx tsc --noEmit 2>&1 | tee /tmp/tsc_output.txt; then
        check_pass "TypeScript 类型检查通过 (0 errors)"
    else
        ERRORS=$(grep -c "error TS" /tmp/tsc_output.txt 2>/dev/null || echo "0")
        if [ "$ERRORS" -gt 0 ]; then
            check_fail "TypeScript 存在 $ERRORS 个错�?
            echo -e "${INFO} 错误摘要:"
            head -20 /tmp/tsc_output.txt | grep "error TS" | head -5
        else
            check_warn "TypeScript 检查有警告"
        fi
    fi
else
    check_warn "TypeScript 未安装，先运�?pnpm install"
fi

# ================================================
# 6. 依赖检�?
# ================================================
print_section "6. 依赖检�?

if [ -d "$PROJECT_ROOT/node_modules" ]; then
    MODULE_COUNT=$(ls -1 "$PROJECT_ROOT/node_modules" 2>/dev/null | wc -l)
    check_pass "node_modules 已安�?($MODULES_COUNT 个包)"
    
    # 关键依赖检�?
    KEY_DEPS=("next" "react" "typescript" "drizzle-orm" "@radix-ui/react-dialog")
    for dep in "${KEY_DEPS[@]}"; do
        if [ -d "$PROJECT_ROOT/node_modules/$dep" ]; then
            check_pass "  - $dep"
        else
            check_fail "  - $dep 缺失"
        fi
    done
else
    check_fail "node_modules 未安�?(运行: pnpm install)"
fi

# ================================================
# 7. 端口检�?
# ================================================
print_section "7. 端口占用检�?

DEFAULT_PORT="${PORT:-5000}"
if command -v lsof &> /dev/null; then
    if lsof -i :$DEFAULT_PORT &> /dev/null; then
        check_warn "端口 $DEFAULT_PORT 已被占用"
        lsof -i :$DEFAULT_PORT | head -3
    else
        check_pass "端口 $DEFAULT_PORT 可用"
    fi
elif command -v netstat &> /dev/null; then
    if netstat -tuln 2>/dev/null | grep -q ":$DEFAULT_PORT "; then
        check_warn "端口 $DEFAULT_PORT 已被占用"
    else
        check_pass "端口 $DEFAULT_PORT 可用"
    fi
else
    check_info "无法检查端口占�?(lsof/netstat 不可�?"
fi

# ================================================
# 8. 磁盘空间检�?
# ================================================
print_section "8. 磁盘空间检�?

if command -v df &> /dev/null; then
    AVAILABLE=$(df -BG "$PROJECT_ROOT" | tail -1 | awk '{print $4}' | sed 's/G//')
    if [ "$AVAILABLE" -gt 10 ]; then
        check_pass "磁盘空间充足 (${AVAILABLE}GB 可用)"
    elif [ "$AVAILABLE" -gt 5 ]; then
        check_warn "磁盘空间偏低 (${AVAILABLE}GB 可用)"
    else
        check_fail "磁盘空间不足 (${AVAILABLE}GB 可用)"
    fi
fi

# ================================================
# 9. 可执行权限检�?
# ================================================
print_section "9. 脚本权限检�?

SCRIPTS=("scripts/dev.sh" "scripts/build.sh" "scripts/start.sh")
for script in "${SCRIPTS[@]}"; do
    if [ -f "$PROJECT_ROOT/$script" ]; then
        if [ -x "$PROJECT_ROOT/$script" ]; then
            check_pass "$script 可执�?
        else
            chmod +x "$PROJECT_ROOT/$script"
            check_pass "$script 已添加执行权�?
        fi
    fi
done

# ================================================
# 10. 网络可达性检�?
# ================================================
print_section "10. 网络配置检�?

# 检查配置的 APP_URL
if [ -n "$NEXT_PUBLIC_APP_URL" ]; then
    APP_HOST=$(echo "$NEXT_PUBLIC_APP_URL" | sed -n 's|.*://\([^:/]*\).*|\1|p')
    if [[ "$APP_HOST" == "localhost" ]] || [[ "$APP_HOST" == "127.0.0.1" ]]; then
        check_info "APP_URL 配置为本地访�?
    elif [[ "$APP_HOST" == *".local"* ]]; then
        check_pass "APP_URL 使用局域网域名: $APP_HOST"
    else
        check_info "APP_URL: $NEXT_PUBLIC_APP_URL"
    fi
fi

# 检�?AI API 配置
AI_PROVIDERS=("ZHIPU_API_KEY" "DOUBAO_API_KEY" "OPENAI_API_KEY" "MINIMAX_API_KEY")
AI_CONFIGURED=0
for provider in "${AI_PROVIDERS[@]}"; do
    if [ -n "${!provider}" ] && [[ "${!provider}" != *"YOUR_"* ]]; then
        ((AI_CONFIGURED++)) || true
    fi
done

if [ "$AI_CONFIGURED" -gt 0 ]; then
    check_pass "$AI_CONFIGURED �?AI Provider 已配�?
else
    check_warn "未配置任�?AI Provider (图片生成功能不可�?"
fi

# ================================================
# 11. 安全检�?
# ================================================
print_section "11. 安全检�?

# 检�?JWT_SECRET
if [ -n "$JWT_SECRET" ] && [[ ${#JWT_SECRET} -ge 32 ]]; then
    check_pass "JWT_SECRET 强度足够 (${#JWT_SECRET} 字符)"
elif [ -n "$JWT_SECRET" ]; then
    check_warn "JWT_SECRET 可能太短 (建议 >= 32 字符)"
fi

# 检查是否在 Git 中提交了敏感信息
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    if git -C "$PROJECT_ROOT" check-ignore ".env.local" &> /dev/null; then
        check_pass ".env.local 已被 .gitignore 忽略"
    else
        check_warn ".env.local 可能�?Git 追踪，请确认 .gitignore 配置"
    fi
fi

# ================================================
# 结果汇�?
# ================================================
print_section "检查结果汇�?

TOTAL=$((PASS + FAIL + WARN_COUNT))
echo -e "总计: ${TOTAL} 项检�?
echo -e "${GREEN}通过: $PASS${NC}"
[ "$WARN_COUNT" -gt 0 ] && echo -e "${YELLOW}警告: $WARN_COUNT${NC}"
[ "$FAIL" -gt 0 ] && echo -e "${RED}失败: $FAIL${NC}"

echo ""
if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}${BOLD}🎉 部署检查完成！项目可以部署�?{NC}"
    echo ""
    echo -e "下一�?"
    echo -e "  1. ${BLUE}bash scripts/health-check.sh${NC} - 再次验证"
    echo -e "  2. ${BLUE}pnpm build${NC} - 构建生产版本"
    echo -e "  3. ${BLUE}pnpm start${NC} - 启动服务"
    echo ""
    exit 0
else
    echo -e "${RED}${BOLD}�?检查未通过，请修复上述失败项后再部署�?{NC}"
    echo ""
    exit 1
fi
