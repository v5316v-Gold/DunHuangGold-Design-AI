#!/usr/bin/env bash
# ==========================================
# 敦煌�?AI 设计平台 - Docker 健康检查脚�?
# ==========================================
# 用途：检�?WSL Docker Desktop 端口转发 ECONNREFUSED
#       自动恢复（重�?Docker Desktop 后等 30s 再验证）
#
# 用法�?
#   bash scripts/docker-health-check.sh        # 检查一�?
#   bash scripts/docker-health-check.sh watch  # 持续监控（每 30s�?
#
# 退出码�?
#   0 = 健康
#   1 = 已自动恢�?
#   2 = 失败需人工干预
# ==========================================

set -e

LOG_FILE="/tmp/docker-health-check.log"
PYTHON_BIN="/c/Users/v5316/.hermes-web-ui/desktop-runtime/hermes/0.20.0/win-x64/node/npm/node"  # 任意 Node 二进制用�?TCP 测试（未使用，仅占位�?

log() {
  echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LOG_FILE" >&2
}

check_tcp() {
  local port="$1"
  node -e "
    const net = require('net');
    const s = net.createConnection({ host: '127.0.0.1', port: $port, timeout: 2000 });
    s.on('connect', () => { s.end(); process.exit(0); });
    s.on('error', () => process.exit(1));
    s.on('timeout', () => { s.destroy(); process.exit(1); });
  " 2>/dev/null
}

restart_docker() {
  log "⚠️  检测到 ECONNREFUSED，重�?Docker Desktop..."

  # 1. 杀 Docker Desktop
  /c/Windows/System32/taskkill.exe //F //IM "Docker Desktop.exe" 2>/dev/null || true
  sleep 3

  # 2. 重启
  nohup "/c/Program Files/Docker/Docker/Docker Desktop.exe" > /tmp/docker-restart.log 2>&1 &
  log "Docker Desktop 重启中（pid=$!），等待 35s..."

  sleep 35

  # 3. 验证
  for i in 1 2 3 4 5; do
    if check_tcp 5432 && check_tcp 6379; then
      log "�?Docker Desktop 端口转发恢复"
      return 0
    fi
    log "重试 $i/5..."
    sleep 5
  done
  return 1
}

do_check() {
  local tcp_ok=true
  for port in 5432 6379; do
    if check_tcp "$port"; then
      log "�?TCP 127.0.0.1:$port OK"
    else
      log "�?TCP 127.0.0.1:$port ECONNREFUSED"
      tcp_ok=false
    fi
  done

  if [ "$tcp_ok" = true ]; then
    return 0
  fi

  log "⚠️  端口转发失败，尝试自动恢�?.."
  if restart_docker; then
    log "�?已自动恢�?
    return 1
  fi
  log "�?自动恢复失败，需人工干预"
  return 2
}

if [ "${1:-}" = "watch" ]; then
  log "持续监控模式�?0s 间隔，Ctrl+C 退出）"
  while true; do
    do_check || true
    sleep 30
  done
else
  do_check
fi