#!/usr/bin/env bash
# Dựng mạng Docker và container Postgres của mgi-bank nếu chưa có, rồi chờ DB nhận kết nối. Chạy lại không sao.
#   cd /opt/mgi-bank && ./deploy/db.sh
# User, mật khẩu, tên database đọc từ DATABASE_URL trong .env.local; mật khẩu chỉ dùng chữ và số (openssl rand -hex 24).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

URL="$(doc_env DATABASE_URL '')"
USER_DB="$(printf '%s' "$URL" | sed -nE 's#^postgres(ql)?://([^:]+):([^@]+)@[^/]+/([^?]+).*#\2#p')"
PASS_DB="$(printf '%s' "$URL" | sed -nE 's#^postgres(ql)?://([^:]+):([^@]+)@[^/]+/([^?]+).*#\3#p')"
TEN_DB="$(printf '%s' "$URL" | sed -nE 's#^postgres(ql)?://([^:]+):([^@]+)@[^/]+/([^?]+).*#\4#p')"
db_url_container >/dev/null
[ -n "$USER_DB" ] && [ -n "$PASS_DB" ] && [ -n "$TEN_DB" ] || { echo "DỪNG: DATABASE_URL phải có dạng postgres://user:matkhau@127.0.0.1:${CONG_DB}/tendb." >&2; exit 1; }
[[ "$PASS_DB" =~ ^[A-Za-z0-9]{16,}$ ]] || { echo "DỪNG: mật khẩu DB phải từ 16 ký tự chữ và số." >&2; exit 1; }

docker network inspect "$MANG" >/dev/null 2>&1 || { docker network create "$MANG" >/dev/null; echo "Đã tạo mạng $MANG."; }

if ! docker container inspect "$DB" >/dev/null 2>&1; then
  # Cổng chỉ mở ở 127.0.0.1: bỏ đi thì Docker tự mở iptables ra Internet, đi vòng qua tường lửa.
  docker run -d --name "$DB" --restart unless-stopped \
    --network "$MANG" \
    --shm-size 256m \
    --log-opt max-size=10m --log-opt max-file=3 \
    -e POSTGRES_DB="$TEN_DB" -e POSTGRES_USER="$USER_DB" -e POSTGRES_PASSWORD="$PASS_DB" \
    -p "127.0.0.1:${CONG_DB}:5432" \
    -v "$DB-data":/var/lib/postgresql/data \
    postgres:16-alpine >/dev/null
  echo "Đã tạo container $DB, volume $DB-data."
fi
docker start "$DB" >/dev/null
for _ in $(seq 30); do
  docker exec "$DB" pg_isready -U "$USER_DB" -d "$TEN_DB" >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$DB" pg_isready -U "$USER_DB" -d "$TEN_DB" >/dev/null || { echo "KHÔNG ĐẠT: $DB không nhận kết nối." >&2; exit 1; }
echo "XONG. $DB nhận kết nối ở 127.0.0.1:${CONG_DB}."
