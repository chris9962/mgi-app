#!/usr/bin/env bash
# Phần dùng chung của các script deploy, không chạy trực tiếp: script khác source vào.
# Bản test đặt TEN=mgi-bank-test và CONG_DB=5437 trước khi source, để không đụng container và DB của production.
set -euo pipefail

GOC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$GOC"

TEN="${TEN:-mgi-bank}"
MANG="$TEN-net"
DB="$TEN-db"
CONG_DB="${CONG_DB:-5436}"
MAU_LOI='ECONNREFUSED\|ERR_DLOPEN\|Failed query\|Cannot find\|Failed to load'

[ -f "$GOC/.env.local" ] || { echo "DỪNG: thiếu $GOC/.env.local (docs/deploy.md mục 4)." >&2; exit 1; }

# Đọc biến bằng grep chứ không source: khoá S3 có ký tự mà shell diễn giải sai.
doc_env() {
  local dong
  dong="$(grep -E "^${1}=" "$GOC/.env.local" 2>/dev/null | tail -1)" || true
  dong="${dong#*=}"
  echo "${dong:-$2}"
}

# .env.local trỏ DB vào 127.0.0.1 của máy chủ cho lệnh chạy trên máy chủ (migrate, seed, ops-watch, sao lưu).
DB_URL_MAY_CHU="$(doc_env DATABASE_URL '')"
case "$DB_URL_MAY_CHU" in
  *@127.0.0.1:${CONG_DB}/* | *@localhost:${CONG_DB}/*) ;;
  *) echo "DỪNG: DATABASE_URL trong .env.local phải trỏ 127.0.0.1:${CONG_DB}." >&2; exit 1 ;;
esac
# Bun lấy DATABASE_URL của shell trước .env.local: shell của root còn giữ URL production thì bản test migrate nhầm DB production.
export DATABASE_URL="$DB_URL_MAY_CHU"

# Trong container, 127.0.0.1 là chính container: app và worker gọi DB bằng tên container trong mạng riêng.
db_url_container() {
  echo "$DB_URL_MAY_CHU" | sed -E "s#@(127\.0\.0\.1|localhost):${CONG_DB}/#@${DB}:5432/#"
}

# Cờ docker run chung của app và worker: mạng riêng, giới hạn log (json-file mặc định không xoay vòng), env từ file.
chung() {
  CHUNG=(
    --network "$MANG"
    --log-opt max-size=10m --log-opt max-file=3
    --env-file "$GOC/.env.local"
    -e DATABASE_URL="$(db_url_container)"
  )
}

# stop trước rm: worker nhận SIGTERM thì làm nốt lượt đang chạy rồi thoát.
dung_container() {
  docker stop -t "$2" "$1" >/dev/null 2>&1 || true
  docker rm "$1" >/dev/null 2>&1 || true
}

# Container phải còn chạy sau vài giây và log có dòng "đang chạy" của worker.
kiem_worker() {
  sleep 8
  [ "$(docker inspect --format '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ] || { docker logs "$1" 2>&1 | tail -20 >&2; echo "KHÔNG ĐẠT: $1 không chạy." >&2; exit 1; }
  docker logs "$1" 2>&1 | grep -q "đang chạy" || { docker logs "$1" 2>&1 | tail -20 >&2; echo "KHÔNG ĐẠT: log của $1 thiếu dòng đang chạy." >&2; exit 1; }
}
