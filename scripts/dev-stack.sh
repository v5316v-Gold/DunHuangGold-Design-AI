#!/usr/bin/env bash
# Phase 1 · 5-container dev stack launcher
# 用法: bash scripts/dev-stack.sh up | down | restart | logs | status
#
# ADR-005: Docker Compose for Development (1Panel removed)
# ADR-007: Service-Name Networking (postgres, redis)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 在 WSL 中将 Windows 路径 /e/hermes/... 转为内部 /mnt/e/...
if grep -q "^/e/" <<< "$SCRIPT_DIR" 2>/dev/null; then
  PROJECT_DIR=$(echo "$PROJECT_DIR" | sed 's|^/e/|/mnt/e/|')
  COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
  ENV_FILE="$PROJECT_DIR/.env.development"
else
  COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"
  ENV_FILE="$PROJECT_DIR/.env.development"
fi

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err() { echo -e "${RED}[ERR]${NC} $*"; }

check_prereq() {
  if ! command -v docker >/dev/null 2>&1; then
    err "docker not found. Install Docker Desktop with WSL2."
    exit 1
  fi
  if ! docker compose version >/dev/null 2>&1; then
    err "docker compose plugin not found."
    exit 1
  fi
}

# Check 1Panel interference
check_onepanel() {
  local panel_pg=$(docker ps --format '{{.Names}}' 2>/dev/null | grep 'postgresql-DHgold' || true)
  local panel_redis=$(docker ps --format '{{.Names}}' 2>/dev/null | grep 'dunhuang-redis' || true)
  if [ -n "$panel_pg" ] || [ -n "$panel_redis" ]; then
    warn "Detected 1Panel-managed containers: $panel_pg $panel_redis"
    warn "Per ADR-005, Phase 1 should remove 1Panel from dev path."
    warn "Run: docker stop postgresql-DHgold dunhuang-redis"
    return 1
  fi
  return 0
}

cmd_up() {
  check_prereq
  if ! check_onepanel; then
    err "1Panel containers still running. Refusing to start dev stack to avoid conflict."
    exit 1
  fi
  log "Starting dev stack (5 containers: web, worker, postgres, redis)..."
  cd "$PROJECT_DIR"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d
  log "Waiting for health checks..."
  sleep 10
  cmd_status
}

cmd_down() {
  check_prereq
  log "Stopping dev stack..."
  cd "$PROJECT_DIR"
  docker compose -f "$COMPOSE_FILE" down
  log "Data volumes preserved (use 'down -v' to remove)."
}

cmd_status() {
  check_prereq
  cd "$PROJECT_DIR"
  echo
  docker compose -f "$COMPOSE_FILE" ps
  echo
  log "Health check:"
  for svc in postgres redis web worker; do
    cid=$(docker compose -f "$COMPOSE_FILE" ps -q "$svc" 2>/dev/null | head -1)
    if [ -n "$cid" ]; then
      state=$(docker inspect --format '{{.State.Health.Status}}' "$cid" 2>/dev/null)
      printf "  %-10s %s\n" "$svc" "$state"
    else
      printf "  %-10s %s\n" "$svc" "(not running)"
    fi
  done
}

cmd_logs() {
  cd "$PROJECT_DIR"
  docker compose -f "$COMPOSE_FILE" logs -f "${2:-}"
}

cmd_restart() {
  cmd_down
  cmd_up
}

case "${1:-}" in
  up) cmd_up ;;
  down) cmd_down ;;
  status) cmd_status ;;
  logs) cmd_logs "$2" ;;
  restart) cmd_restart ;;
  *) echo "Usage: $0 {up|down|status|logs|restart}"; exit 1 ;;
esac
