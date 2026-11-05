#!/usr/bin/env bash
# Dựng lại và thay container mgi-bank-sms, worker gửi tin voucher. Chạy trên máy chủ sau deploy.sh:
#   cd /opt/mgi-bank && ./deploy/worker-sms.sh --chap-nhan-chi-ghi-log
# Bản hiện tại chưa nối nhà cung cấp SMS: src/server/sms/send.ts chỉ ghi log rồi đánh dấu tin Đã gửi, phụ huynh không nhận tin nào.
# Cờ --chap-nhan-chi-ghi-log bắt người chạy nói rõ điều đó; nối nhà cung cấp xong thì bỏ cờ này khỏi script.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

if [[ " $* " != *" --chap-nhan-chi-ghi-log "* ]]; then
  echo "DỪNG: worker SMS chưa nối nhà cung cấp, tin sẽ bị đánh dấu Đã gửi mà không gửi. Chạy lại với --chap-nhan-chi-ghi-log nếu chấp nhận." >&2
  exit 1
fi

NAME="$TEN-sms"
IMAGE="$TEN-sms"
chung

echo "== Dựng image $IMAGE:new =="
echo "  HEAD: $(git log --oneline -1)"
docker build --target sms-worker -t "$IMAGE:new" .

echo "== Thay $NAME =="
dung_container "$NAME" 30
docker run -d --name "$NAME" --restart unless-stopped --stop-timeout 30 --memory 512m \
  "${CHUNG[@]}" "$IMAGE:new" >/dev/null
kiem_worker "$NAME"
docker tag "$IMAGE:new" "$IMAGE:latest"
echo "XONG. $NAME chạy $(git log --oneline -1). Xem log: docker logs -f $NAME"
