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

# Máy Windows (Git Bash) không có lsof: tìm PID giữ cổng bằng netstat và dừng bằng taskkill, không thì server cũ còn chạy và test chạy nhầm bản build cũ.
listening() {
  if command -v lsof > /dev/null; then lsof -ti tcp:3100 -sTCP:LISTEN || true
  else netstat -ano 2>/dev/null | awk '/[:.]3100 .*LISTEN/ {print $NF}' | sort -u; fi
}
pids=$(listening)
if [ -n "$pids" ]; then
  for pid in $pids; do
    if command -v taskkill > /dev/null; then taskkill //F //PID "$pid" > /dev/null 2>&1 || true; else kill "$pid"; fi
  done
  for _ in $(seq 1 30); do [ -z "$(listening)" ] && break; sleep 1; done
fi

# COOKIE_SECURE=false: cookie Secure trên http không đi kèm request API của Playwright.
# TZ=UTC: máy dev và container đều ở +07, code lỡ dùng giờ của máy thì test giờ Việt Nam vẫn pass nếu không ép UTC.
COOKIE_SECURE=false TZ=UTC nohup bunx next start -p 3100 > "$LOG_DIR/mgi-bank-e2e-server.log" 2>&1 &
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
