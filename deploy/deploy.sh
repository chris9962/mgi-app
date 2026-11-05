#!/usr/bin/env bash
# Deploy bản mới của app lên production. Chạy trên máy chủ:
#   cd /opt/mgi-bank && git pull && ./deploy/deploy.sh
# Chỉ đụng container app. Worker và job làm sau, từng cái một: deploy/worker-photo.sh, deploy/worker-sms.sh, deploy/jobs.sh.
# Pha 1 không bảo trì: lấy code, kiểm env, dựng và thử image, sao lưu DB. Pha 2 bật bảo trì vài chục giây:
# migrate, đổi container, kiểm; không đạt thì tự lùi về container cũ rồi mới tắt bảo trì.
# Là script chứ không phải danh sách lệnh vì mgst-app từng gõ tay theo trí nhớ sai bốn lượt liền trên production.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

APP="$TEN-app"
IMAGE="$TEN-app"
CONG_APP=3200
CONG_THU=3201
NHANH="${NHANH:-main}"

ma_http() { curl -s -o /dev/null -w '%{http_code}' -H "Host: $2" "http://127.0.0.1:$1$3"; }
ma_login() { curl -s -o /dev/null -w '%{http_code}' -X POST -H "Host: $2" -H "Origin: https://$2" -H 'Content-Type: application/json' -d '{"username":"zz_khong_co","password":"x"}' "http://127.0.0.1:$1/api/admin/login"; }

echo "== 1/7 Lấy code nhánh $NHANH =="
git fetch origin "$NHANH"
git reset --hard "origin/$NHANH"
echo "  HEAD: $(git log --oneline -1)"

echo "== 2/7 Kiểm .env.local =="
for BIEN in DATABASE_URL ADMIN_HOST STUDENT_HOST STUDENT_ORIGIN S3_ENDPOINT S3_REGION S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY VOUCHER_SECRET; do
  [ -n "$(doc_env "$BIEN" '')" ] || { echo "DỪNG: thiếu $BIEN trong .env.local (docs/deploy.md mục 4)." >&2; exit 1; }
done
# Thiếu VOUCHER_SECRET thì đánh dấu Đạt không cấp được voucher; đổi khoá sau khi đã cấp mã thì mã cũ không kiểm lại được.
[ "$(doc_env S3_BUCKET '')" != "mgst-images" ] || { echo "DỪNG: S3_BUCKET là bucket của mgst-app." >&2; exit 1; }
ADMIN_HOST="$(doc_env ADMIN_HOST '')"
STUDENT_HOST="$(doc_env STUDENT_HOST '')"
chung
echo "  env: đạt"

echo "== 3/7 Cài gói, dựng image $IMAGE:new =="
bun install --frozen-lockfile
# --target runner bắt buộc theo thói quen của mgst-app; tag :new, giữ :latest để lùi được.
docker build --target runner -t "$IMAGE:new" .

echo "== 4/7 Thử image ở cổng $CONG_THU =="
# App đổi mọi ảnh sang WebP bằng sharp lúc nhận. sharp là module native: thiếu libvips trong image thì chỉ lộ ra lúc học sinh gửi ảnh.
docker run --rm -w /app "$IMAGE:new" bun -e 'require("sharp")({ create: { width: 8, height: 8, channels: 3, background: "#fff" } }).webp().toBuffer().then((b) => console.log("  sharp: đổi được WebP, " + b.length + " byte"))'
docker rm -f "$TEN-app-thu" >/dev/null 2>&1 || true
docker run -d --name "$TEN-app-thu" "${CHUNG[@]}" -p "127.0.0.1:${CONG_THU}:3000" "$IMAGE:new" >/dev/null
sleep 8
thu() {
  local mong="$1" ma="$2" mo_ta="$3"
  if [ "$ma" != "$mong" ]; then
    echo "KHÔNG ĐẠT: $mo_ta trả $ma, mong $mong." >&2
    docker logs "$TEN-app-thu" 2>&1 | tail -20 >&2
    docker rm -f "$TEN-app-thu" >/dev/null
    exit 1
  fi
  echo "  $mo_ta: $ma"
}
thu 200 "$(ma_http "$CONG_THU" "$ADMIN_HOST" /login)" "trang đăng nhập"
thu 401 "$(ma_http "$CONG_THU" "$ADMIN_HOST" /api/admin/schools/options)" "API quản lý chưa đăng nhập"
thu 200 "$(ma_http "$CONG_THU" "$STUDENT_HOST" /)" "web học sinh"
# Đăng nhập sai đọc bảng users: 401 nghĩa là app nối được DB, 500 là không.
thu 401 "$(ma_login "$CONG_THU" "$ADMIN_HOST")" "đăng nhập sai qua DB"
LOI="$(docker logs "$TEN-app-thu" 2>&1 | grep -c "$MAU_LOI" || true)"
docker rm -f "$TEN-app-thu" >/dev/null
[ "$LOI" = "0" ] || { echo "KHÔNG ĐẠT: log container thử có $LOI dòng lỗi." >&2; exit 1; }
echo "  log: sạch"

echo "== 5/7 Sao lưu DB trước khi migrate =="
USER_DB="$(doc_env DATABASE_URL '' | sed -nE 's#^postgres(ql)?://([^:]+):.*#\2#p')"
TEN_DB="$(doc_env DATABASE_URL '' | sed -nE 's#.*/([^/?]+)(\?.*)?$#\1#p')"
TEP="/root/$TEN-truoc-deploy-$(date +%F-%H%M).dump"
docker exec "$DB" pg_dump -U "$USER_DB" -d "$TEN_DB" -Fc > "$TEP"
echo "  $TEP ($(du -h "$TEP" | cut -f1))"

echo "== 6/7 Bật bảo trì, migrate, đổi container =="
./deploy/maintenance-on.sh
# Luôn chạy: drizzle chỉ áp migration còn thiếu. Script in database đang nối và số migration mới.
bun run db:migrate
# Giữ đúng một bản lùi, tên mang giờ đổi.
docker rm "$(docker ps -aq --filter "name=^$APP-cu-")" >/dev/null 2>&1 || true
BAN_CU=""
if docker container inspect "$APP" >/dev/null 2>&1; then
  BAN_CU="$APP-cu-$(date +%Y%m%d-%H%M)"
  docker stop "$APP" >/dev/null
  docker rename "$APP" "$BAN_CU"
fi
chay_app() {
  docker run -d --name "$APP" --restart unless-stopped "${CHUNG[@]}" -p "127.0.0.1:${CONG_APP}:3000" "$1" >/dev/null
  sleep 8
}
chay_app "$IMAGE:new"

echo "== 7/7 Kiểm bản mới =="
MA_LOGIN="$(ma_http "$CONG_APP" "$ADMIN_HOST" /login)"
MA_API="$(ma_http "$CONG_APP" "$ADMIN_HOST" /api/admin/schools/options)"
MA_HS="$(ma_http "$CONG_APP" "$STUDENT_HOST" /)"
LOI="$(docker logs "$APP" 2>&1 | grep -c "$MAU_LOI" || true)"
echo "  /login $MA_LOGIN, API $MA_API, web học sinh $MA_HS, lỗi trong log $LOI"
if [ "$MA_LOGIN" = "200" ] && [ "$MA_API" = "401" ] && [ "$MA_HS" = "200" ] && [ "$LOI" = "0" ]; then
  docker tag "$IMAGE:new" "$IMAGE:latest"
  ./deploy/maintenance-off.sh
  echo
  echo "DEPLOY APP XONG. Đang chạy $(git log --oneline -1). Bản lùi: ${BAN_CU:-không có}. Bản dump: $TEP."
  echo "Tiếp theo, từng cái một: ./deploy/worker-photo.sh, ./deploy/worker-sms.sh (khi đã nối nhà cung cấp SMS), ./deploy/jobs.sh"
  exit 0
fi

echo "KHÔNG ĐẠT, lùi về ${BAN_CU:-không có bản cũ}." >&2
docker logs "$APP" 2>&1 | tail -20 >&2
docker rm -f "$APP" >/dev/null
if [ -n "$BAN_CU" ]; then
  docker rename "$BAN_CU" "$APP"
  docker start "$APP" >/dev/null
  sleep 8
  echo "  bản cũ: /login $(ma_http "$CONG_APP" "$ADMIN_HOST" /login)" >&2
fi
./deploy/maintenance-off.sh
# Lượt này có migrate thì DB đã đổi mà code lùi; khôi phục DB làm mất dữ liệu nhập trong lúc bản mới chạy, nên người deploy tự quyết.
echo "ĐÃ LÙI. Nếu lượt này có migration mới, xem docs/deploy.md mục 9. Bản dump: $TEP" >&2
exit 1
