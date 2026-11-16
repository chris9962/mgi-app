#!/usr/bin/env bash
# Quay video hướng dẫn trên DB riêng mgibank_video: tạo lại DB, migrate, seed tên thật, chạy spec, chép video. Chạy xong không dọn dữ liệu.
# Cách dùng: bash scripts/video-run.sh <spec trong e2e/flows>... E2E_SKIP_BUILD=1 thì dùng lại bản build có sẵn.
set -u
cd "$(dirname "$0")/.."
URL=http://admin.localhost:3100/login
LOG_DIR=${TMPDIR:-/tmp}
VIDEO_DB=mgibank_video

base=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)
export DATABASE_URL="${base%/*}/$VIDEO_DB"

if [ "${E2E_SKIP_BUILD:-0}" != "1" ]; then
  echo "Build production..."
  bun run build > "$LOG_DIR/mgi-bank-e2e-build.log" 2>&1 || { tail -40 "$LOG_DIR/mgi-bank-e2e-build.log"; echo "Build lỗi, log ở $LOG_DIR/mgi-bank-e2e-build.log"; exit 1; }
fi

# Server cũ có thể đang giữ kết nối tới DB video: tắt trước khi xoá DB.
pids=$(lsof -ti tcp:3100 -sTCP:LISTEN || true)
if [ -n "$pids" ]; then
  kill $pids
  for _ in $(seq 1 30); do lsof -ti tcp:3100 -sTCP:LISTEN > /dev/null || break; sleep 1; done
fi

docker exec mgi-bank-db psql -q -U mgibank -d postgres -c "DROP DATABASE IF EXISTS $VIDEO_DB WITH (FORCE)" -c "CREATE DATABASE $VIDEO_DB OWNER mgibank" || exit 1
bun --env-file=.env.local scripts/db-migrate.ts || exit 1
bun --env-file=.env.local scripts/db-seed.ts || exit 1
bun --env-file=.env.local scripts/video-seed.ts || exit 1

# DATABASE_URL đã đặt ở trên thắng .env.local nên server đọc DB video.
COOKIE_SECURE=false TZ=UTC nohup bunx next start -p 3100 > "$LOG_DIR/mgi-bank-e2e-server.log" 2>&1 &
for _ in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$URL")" = "200" ] && break
  sleep 1
done
[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$URL")" = "200" ] || { tail -40 "$LOG_DIR/mgi-bank-e2e-server.log"; echo "Server không lên"; exit 1; }

PLAYWRIGHT_JSON_OUTPUT_FILE=test-results/videos.json bunx playwright test --project=flows --reporter=list,json "$@"
status=$?
bun scripts/e2e-videos.ts test-results/videos.json
exit $status
