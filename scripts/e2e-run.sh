#!/usr/bin/env bash
# Chạy e2e trên bản build production ở cổng 3100: dev server biên dịch trang lúc có request và biên dịch lại khi file đổi, test chậm và fail không do app.
# Cách dùng: bash scripts/e2e-run.sh <tham số của playwright test>. E2E_SKIP_BUILD=1 thì dùng lại bản build có sẵn.
set -u
cd "$(dirname "$0")/.."
URL=http://admin.localhost:3100/login
LOG_DIR=${TMPDIR:-/tmp}

if [ "${E2E_SKIP_BUILD:-0}" != "1" ]; then
  echo "Build production..."
  bun run build > "$LOG_DIR/mgi-bank-e2e-build.log" 2>&1 || { tail -40 "$LOG_DIR/mgi-bank-e2e-build.log"; echo "Build lỗi, log ở $LOG_DIR/mgi-bank-e2e-build.log"; exit 1; }
fi

pids=$(lsof -ti tcp:3100 -sTCP:LISTEN || true)
if [ -n "$pids" ]; then
  kill $pids
  for _ in $(seq 1 30); do lsof -ti tcp:3100 -sTCP:LISTEN > /dev/null || break; sleep 1; done
fi

# COOKIE_SECURE=false: cookie Secure trên http không đi kèm request API của Playwright.
COOKIE_SECURE=false nohup bunx next start -p 3100 > "$LOG_DIR/mgi-bank-e2e-server.log" 2>&1 &
for _ in $(seq 1 60); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$URL")" = "200" ] && break
  sleep 1
done
[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$URL")" = "200" ] || { tail -40 "$LOG_DIR/mgi-bank-e2e-server.log"; echo "Server không lên"; exit 1; }

bun --env-file=.env.local scripts/e2e-seed.ts || exit 1
bunx playwright test "$@"
status=$?
bun --env-file=.env.local scripts/e2e-clean.ts
exit $status
