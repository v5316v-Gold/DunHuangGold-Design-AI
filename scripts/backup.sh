#!/bin/bash
# ============================================================
# 敦煌金 AI 平台 - 一体化备份脚本(W3)
# 同时备份 PostgreSQL 数据 + MinIO 对象存储 + 应用配置
#
# 用法:
#   BACKUP_DIR=/var/backups/dunhuang bash scripts/backup.sh
#   BACKUP_DIR=/d/backups bash scripts/backup.sh --prune --upload s3://bucket/prefix
#
# 设计:
#   - PG:用 docker exec 拿 pg_dump(custom 格式, 支持选择性 restore)
#   - MinIO:用 mc mirror --overwrite = false + --remove = false 安全拷贝
#   - tar.gz 打包所有产物放入 timestamp 目录
#   - manifest.json 记录 sha256 + size 便于校验
#
# 建议 cron(每日 03:00):
#   0 3 * * * cd /path/to/project && bash scripts/backup.sh --prune >> /var/log/dunhuang-backup.log 2>&1
# ============================================================

set -euo pipefail

DATETIME="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-dunhuang1}"
DB_NAME="${DB_NAME:-dunhuang}"
DB_PASSWORD="${DB_PASSWORD:-dunhuang2026}"

MINIO_BUCKET="${MINIO_BUCKET:-dunhuang-uploads}"
MINIO_ALIAS="${MINIO_ALIAS:-local}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-dunhuang}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-dunhuang2026}"

PRUNE=0
UPLOAD_TO=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prune) PRUNE=1; shift ;;
    --upload) UPLOAD_TO="$2"; shift 2 ;;
    *) echo "unknown arg: $1"; exit 1 ;;
  esac
done

OUT_DIR="${BACKUP_DIR}/dunhuang_${DATETIME}"
mkdir -p "$OUT_DIR"
LOGFILE="${OUT_DIR}/backup.log"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"; }

log "=== 一体化备份启动 -> $OUT_DIR ==="

# ---------- 1. PG ----------
log "--- 备份 PostgreSQL ---"
PG_FILE="${OUT_DIR}/dunhuang_${DATETIME}.dump"
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q dunhuang-postgres; then
  if docker exec dunhuang-postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --format=custom > "$PG_FILE" 2>>"$LOGFILE"; then
    log "✅ PG dump OK ($(du -h "$PG_FILE" | cut -f1))"
  else
    log "❌ docker pg_dump 失败"; exit 1
  fi
elif command -v pg_dump >/dev/null 2>&1; then
  if PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --format=custom > "$PG_FILE" 2>>"$LOGFILE"; then
    log "✅ PG dump OK ($(du -h "$PG_FILE" | cut -f1))"
  else
    log "❌ host pg_dump 失败"; exit 1
  fi
else
  log "⚠️  跳过 PG(无 docker + 无 host pg_dump)"
fi

# ---------- 2. MinIO ----------
log "--- 备份 MinIO bucket: $MINIO_BUCKET ---"
MC_FILE="${OUT_DIR}/minio_${MINIO_BUCKET}.tar.gz"
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q dunhuang-minio; then
  docker exec dunhuang-minio sh -c "
    mc alias set $MINIO_ALIAS $MINIO_ENDPOINT $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD >/dev/null 2>&1
    if mc ls $MINIO_ALIAS/$MINIO_BUCKET >/dev/null 2>&1; then
      mkdir -p /tmp/backup_minio
      mc mirror --overwrite=false $MINIO_ALIAS/$MINIO_BUCKET /tmp/backup_minio >/dev/null 2>&1
      tar -czf - -C /tmp backup_minio
    fi
  " > "$MC_FILE.tmp" 2>>"$LOGFILE" || true
  if [[ -s "$MC_FILE.tmp" ]]; then
    mv "$MC_FILE.tmp" "$MC_FILE"
    log "✅ MinIO mirror OK ($(du -h "$MC_FILE" | cut -f1))"
  else
    rm -f "$MC_FILE.tmp"
    log "⚠️  跳过 MinIO(bucket 空或 mc 不可用)"
  fi
elif command -v mc >/dev/null 2>&1; then
  mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null 2>&1
  if mc ls "${MINIO_ALIAS}/${MINIO_BUCKET}" >/dev/null 2>&1; then
    TMP_MIRROR_DIR="$(mktemp -d)"
    mc mirror "${MINIO_ALIAS}/${MINIO_BUCKET}" "$TMP_MIRROR_DIR" >/dev/null 2>&1
    tar -czf "$MC_FILE" -C "$TMP_MIRROR_DIR" . 2>>"$LOGFILE"
    rm -rf "$TMP_MIRROR_DIR"
    log "✅ MinIO mirror OK"
  else
    log "⚠️  bucket 不存在,跳过"
  fi
else
  log "⚠️  跳过 MinIO(无 docker + 无 mc)"
fi

# ---------- 3. 应用配置(只读 key 名,不备份密文) ----------
log "--- 备份应用 .env 元数据 ---"
ENV_META="${OUT_DIR}/env_meta.txt"
{
  echo "snapshot_at=${DATETIME}"
  echo "redis_url_redacted=YES"
  echo "minimax_key_present=$([ -n "${MINIMAX_API_KEY:-}" ] && echo yes || echo no)"
  echo "zhipu_key_present=$([ -n "${ZHIPU_API_KEY:-}" ] && echo yes || echo no)"
  echo "qwen_key_present=$([ -n "${QWEN_API_KEY:-}" ] && echo yes || echo no)"
  echo "openai_key_present=$([ -n "${OPENAI_API_KEY:-}" ] && echo yes || echo no)"
  echo "meshy_key_present=$([ -n "${MESHY_API_KEY:-}" ] && echo yes || echo no)"
  echo "kimi_key_present=$([ -n "${KIMI_API_KEY:-}" ] && echo yes || echo no)"
  echo "encryption_key_present=$([ -n "${API_KEY_ENCRYPTION_KEY:-}" ] && echo yes || echo no)"
  echo "jwt_secret_present=$([ -n "${JWT_SECRET:-}" ] && echo yes || echo no)"
} > "$ENV_META"

# ---------- 4. manifest ----------
log "--- 生成 manifest ---"
MANIFEST="${OUT_DIR}/manifest.json"
cat > "$MANIFEST" <<EOF
{
  "timestamp": "${DATETIME}",
  "version": "w3.0",
  "components": {
    "postgres": $( [ -f "$PG_FILE" ] && echo "true" || echo "false" ),
    "minio": $( [ -f "$MC_FILE" ] && echo "true" || echo "false" ),
    "env_meta": $( [ -f "$ENV_META" ] && echo "true" || echo "false" )
  },
  "files": [
EOF
for f in "$OUT_DIR"/*; do
  if [[ -f "$f" ]]; then
    fname="$(basename "$f")"
    sha="$(sha256sum "$f" | cut -d' ' -f1)"
    sz="$(stat -c%s "$f" 2>/dev/null || stat -f%z "$f")"
    printf '    {"name": "%s", "sha256": "%s", "size": %s},\n' "$fname" "$sha" "$sz" >> "$MANIFEST"
  fi
done
sed -i '$ d' "$MANIFEST"  # 去掉最后一行逗号
echo '    ]' >> "$MANIFEST"
echo '}' >> "$MANIFEST"
log "✅ manifest 已生成"

# ---------- 5. prune ----------
if [[ "$PRUNE" == "1" ]]; then
  log "--- 清理 ${KEEP_DAYS} 天前的备份 ---"
  find "$BACKUP_DIR" -maxdepth 1 -type d -name "dunhuang_*" -mtime "+${KEEP_DAYS}" -exec rm -rf {} \; -print | while read -r d; do
    log "  删除: $(basename "$d")"
  done || true
fi

# ---------- 6. (可选) 上传到远程 ----------
if [[ -n "$UPLOAD_TO" ]]; then
  log "--- 上传至 ${UPLOAD_TO} ---"
  case "$UPLOAD_TO" in
    s3://*)
      if command -v aws >/dev/null 2>&1; then
        aws s3 cp --recursive "$OUT_DIR/" "$UPLOAD_TO/$(basename "$OUT_DIR")/" >>"$LOGFILE" 2>&1 \
          && log "✅ S3 upload OK" \
          || log "❌ S3 upload 失败"
      else
        log "⚠️  aws CLI 不在 PATH,跳过"
      fi
      ;;
    mc://*)
      # mc://alias/bucket/prefix  (内置 mc 协议的占位实现)
      dest="${UPLOAD_TO#mc://}"
      if command -v mc >/dev/null 2>&1; then
        mc cp --recursive "$OUT_DIR" "$dest/" >>"$LOGFILE" 2>&1 && log "✅ mc upload OK" || log "❌ mc upload 失败"
      else
        log "⚠️  mc 不在 PATH,跳过"
      fi
      ;;
    *)
      log "⚠️  不支持的 URL 协议: $UPLOAD_TO"
      ;;
  esac
fi

# ---------- 7. 完成 ----------
TOTAL=$(find "$BACKUP_DIR" -maxdepth 1 -type d -name "dunhuang_*" | wc -l)
log "=== 一体化备份完成 ==="
log "本次产物: ${OUT_DIR}"
log "总保留: ${TOTAL} 份"
echo "OK"
