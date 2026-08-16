#!/bin/bash
# ============================================================
# 敦煌金 AI 平台 - 自签 TLS 证书生成(W4)
#
# 用法:
#   bash deploy/gen-selfsigned.sh [--host=192.168.1.10] [--days=365]
#   bash deploy/gen-selfsigned.sh --host=192.168.1.10 --host=dunhuang.local
#
# 产物:
#   ./ssl/server.crt
#   ./ssl/server.key
#   ./ssl/dhparam.pem(可选,加速 ECDHE)
# ============================================================

set -euo pipefail

CERT_DIR="${CERT_DIR:-./ssl}"
DAYS=365
HOSTS=()
COMMON_NAME="dunhuang.local"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host=*)
      HOSTS+=("${1#*=}")
      shift
      ;;
    --days=*)
      DAYS="${1#*=}"
      shift
      ;;
    --cn=*)
      COMMON_NAME="${1#*=}"
      shift
      ;;
    *)
      echo "unknown arg: $1"
      exit 1
      ;;
  esac
done

if [[ ${#HOSTS[@]} -eq 0 ]]; then
  HOSTS=("localhost" "127.0.0.1" "$(hostname -I 2>/dev/null | awk '{print $1}' | head -1)" "dunhuang.local" "$COMMON_NAME")
fi

mkdir -p "$CERT_DIR"
echo "==== 自签证书生成 ===="
echo "  路径: $CERT_DIR"
echo "  域名: ${HOSTS[*]}"
echo "  有效期: ${DAYS} 天"

# 拼接 SAN entries
SAN_ENTRIES=()
for h in "${HOSTS[@]}"; do
  if [[ "$h" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    SAN_ENTRIES+=("IP.${#SAN_ENTRIES[@]}:$h")
  else
    SAN_ENTRIES+=("DNS.${#SAN_ENTRIES[@]}:$h")
  fi
done
SAN_STR=""
i=0
for e in "${SAN_ENTRIES[@]}"; do
  if [[ $i -eq 0 ]]; then SAN_STR+="$e"; else SAN_STR+=",$e"; fi
  i=$((i+1))
done

# 1. 私钥
openssl genrsa -out "$CERT_DIR/server.key" 2048 2>/dev/null
chmod 600 "$CERT_DIR/server.key"

# 2. 自签证书(包含 SAN)
openssl req -new -x509 \
  -key "$CERT_DIR/server.key" \
  -out "$CERT_DIR/server.crt" \
  -days "$DAYS" \
  -subj "/CN=${COMMON_NAME}/O=Dunhuang AI/OU=Local" \
  -addext "subjectAltName=${SAN_STR}" \
  -addext "keyUsage=digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth" 2>/dev/null

# 3. 生成 dhparam(可选,nginx 上 TLSv1.3 默认用 ECDHE,无需 dhparam)
if [[ "${GEN_DHPARAM:-0}" == "1" ]]; then
  openssl dhparam -out "$CERT_DIR/dhparam.pem" 2048 2>/dev/null
fi

echo ""
echo "==== 生成完成 ===="
ls -la "$CERT_DIR"
echo ""
echo "==== nginx 中挂载 ===="
echo "  docker run -p 443:443 -p 80:80 \\"
echo "    -v \$(pwd)/$CERT_DIR:/etc/nginx/ssl:ro \\"
echo "    -v \$(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro \\"
echo "    --network dunhuang-net nginx:1.27-alpine"
echo ""
echo "⚠️  浏览器访问会有 '不安全' 警告(自签证书),需要 '高级' → '继续前往'。"
echo "   生产请用: certbot certonly --webroot -w /var/www/certbot -d your.domain"
