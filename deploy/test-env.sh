#!/usr/bin/env bash
# Bản test chạy chung máy chủ production, container và DB riêng, tên miền riêng. Chạy trong clone riêng /opt/mgi-bank-test:
#   ./deploy/test-env.sh update   lấy nhánh dev, dựng DB nếu chưa có, migrate, dựng image, thay container app
#   ./deploy/test-env.sh off      dừng app và DB của bản test, dữ liệu giữ trong volume
#   ./deploy/test-env.sh on       chạy lại app và DB đã dựng
# Bản test không chạy worker: lượt kiểm ảnh nằm chờ, tin SMS nằm chờ.
set -euo pipefail
export TEN=mgi-bank-test CONG_DB=5437
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# Chạy nhầm trong /opt/mgi-bank là migrate và thay container của production.
[ "$(basename "$GOC")" = "mgi-bank-test" ] || { echo "DỪNG: chỉ chạy trong /opt/mgi-bank-test, đang ở $GOC." >&2; exit 1; }
db_url_container >/dev/null
if [ -f /opt/mgi-bank/.env.local ]; then
  PROD_BUCKET="$(grep -E '^S3_BUCKET=' /opt/mgi-bank/.env.local | tail -1 | cut -d= -f2-)"
  [ "$(doc_env S3_BUCKET '')" != "$PROD_BUCKET" ] || { echo "DỪNG: bản test dùng chung bucket ảnh với production." >&2; exit 1; }
fi

APP="$TEN-app"
CONG_APP=3210
ADMIN_HOST="$(doc_env ADMIN_HOST '')"

case "${1:-}" in
  off)
    docker stop "$APP" "$DB" >/dev/null 2>&1 || true
    echo "Đã tắt bản test."
    ;;
  on)
    docker start "$DB" "$APP" >/dev/null
    sleep 8
    echo "Bản test: /login $(curl -s -o /dev/null -w '%{http_code}' -H "Host: $ADMIN_HOST" "http://127.0.0.1:$CONG_APP/login")"
    ;;
  update)
    git fetch origin dev
    git reset --hard origin/dev
    echo "  HEAD: $(git log --oneline -1)"
    bun install --frozen-lockfile
    ./deploy/db.sh
    bun run db:migrate
    docker build --target runner -t mgi-bank-app:test .
    chung
    docker rm -f "$APP" >/dev/null 2>&1 || true
    # Trần 1 GB để bản test không giành RAM của production.
    docker run -d --name "$APP" --restart unless-stopped --memory 1g --memory-swap 1g \
      "${CHUNG[@]}" -p "127.0.0.1:${CONG_APP}:3000" mgi-bank-app:test >/dev/null
    sleep 8
    MA="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $ADMIN_HOST" "http://127.0.0.1:$CONG_APP/login")"
    [ "$MA" = "200" ] || { docker logs "$APP" 2>&1 | tail -20 >&2; echo "KHÔNG ĐẠT: /login trả $MA." >&2; exit 1; }
    echo "XONG. Bản test chạy $(git log --oneline -1) ở cổng $CONG_APP."
    ;;
  *)
    echo "Dùng: ./deploy/test-env.sh update|on|off" >&2
    exit 1
    ;;
esac
