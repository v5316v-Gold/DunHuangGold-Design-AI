#!/bin/bash
# ============================================================
# 敦煌�?AI 平台 - 数据库自动备份脚�?
# 用法:
#   bash scripts/backup-db.sh              # 立即备份
#   bash scripts/backup-db.sh --prune      # 备份 + 清理 14 天前旧备�?
#
# 建议 cron（每�?03:00�?
#   Windows 计划任务 �?WSL cron:
#   0 3 * * * cd /d/DunHuangGold-Design-AI-main && bash scripts/backup-db.sh --prune >> logs/backup.log 2>&1
# ============================================================

set -euo pipefail

# ===== 配置 =====
BACKUP_DIR="${BACKUP_DIR:-/d/dunhuang-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-dunhuang1}"
DB_NAME="${DB_NAME:-dunhuang}"
DB_PASSWORD="${DB_PASSWORD:-dunhuang2026}"
DATETIME="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"
LOGFILE="${BACKUP_DIR}/backup.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

# ===== 1. PG 备份 =====
log "=== 开始备�? $DB_NAME@$DB_HOST:$DB_PORT ==="

# 通过 docker exec 备份（容器内 psql 免密码）
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q dunhuang-postgres; then
  log "使用 docker exec dunhuang-postgres pg_dump ..."
  if docker exec dunhuang-postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom > "${BACKUP_DIR}/dunhuang_${DATETIME}.dump" 2>>"$LOGFILE"; then
    log "�?PG 备份成功: ${BACKUP_DIR}/dunhuang_${DATETIME}.dump ($(du -h "${BACKUP_DIR}/dunhuang_${DATETIME}.dump" | cut -f1))"
  else
    log "�?PG 备份失败（docker exec 路径�?
    # fallback: 尝试�?host 直连
    log "  尝试 host psql 直连..."
    if PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --format=custom > "${BACKUP_DIR}/dunhuang_${DATETIME}.dump" 2>>"$LOGFILE"; then
      log "�?PG 备份成功（host 直连�? dunhuang_${DATETIME}.dump"
    else
      log "�?PG 备份完全失败"
      exit 1
    fi
  fi
else
  log "使用 host psql 直连 ..."
  if PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --format=custom > "${BACKUP_DIR}/dunhuang_${DATETIME}.dump" 2>>"$LOGFILE"; then
    log "�?PG 备份成功: dunhuang_${DATETIME}.dump ($(du -h "${BACKUP_DIR}/dunhuang_${DATETIME}.dump" | cut -f1))"
  else
    log "�?PG 备份失败"
    exit 1
  fi
fi

# ===== 2. 校验（可选）=====
log "=== 校验备份文件 ==="
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q dunhuang-postgres; then
  docker exec dunhuang-postgres pg_restore -l "${BACKUP_DIR}/dunhuang_${DATETIME}.dump" >/dev/null 2>&1 \
    && log "�?备份文件校验通过" \
    || log "⚠️ 校验跳过（可能需挂载�?
fi

# ===== 3. 清理旧备�?=====
if [[ "${1:-}" == "--prune" ]]; then
  log "=== 清理 ${KEEP_DAYS} 天前的备�?==="
  find "$BACKUP_DIR" -name "dunhuang_*.dump" -mtime "+${KEEP_DAYS}" -delete -print 2>>"$LOGFILE" | while read -r f; do
    log "  删除: $(basename "$f")"
  done
  log "清理完成"
fi

# ===== 4. 统计 =====
TOTAL=$(find "$BACKUP_DIR" -name "dunhuang_*.dump" | wc -l)
LATEST=$(find "$BACKUP_DIR" -name "dunhuang_*.dump" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | cut -d' ' -f2-)
log "=== 备份完成: �?${TOTAL} �? 最�? $(basename "$LATEST" 2>/dev/null || echo '�?) ==="
echo "�?备份完成 -> $BACKUP_DIR"
