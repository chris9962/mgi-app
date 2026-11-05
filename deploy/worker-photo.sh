#!/usr/bin/env bash
# Dựng lại và thay container mgi-bank-photo, worker kiểm ảnh (Python OCR). Chạy trên máy chủ sau deploy.sh:
#   cd /opt/mgi-bank && ./deploy/worker-photo.sh
# Lần dựng đầu tải khoảng 1,5 GB gói và model; các lần sau Docker giữ cache tầng Python.
# Trần RAM, CPU đọc từ .env.local: PHOTO_CHECK_MEMORY (mặc định 4g), PHOTO_CHECK_CPUS (mặc định 2).
# 4g: tiến trình OCR khoảng 1 đến 2 GB, đổi HEIC 48 MP sang JPEG thêm khoảng 1,2 GB. Vượt trần thì Docker chỉ dừng container này;
# lượt đang đọc được nhận lại tối đa 3 lần rồi ghi failed (src/server/photoCheckWorker.ts).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

NAME="$TEN-photo"
IMAGE="$TEN-photo"
chung

echo "== Dựng image $IMAGE:new =="
echo "  HEAD: $(git log --oneline -1)"
docker build --target photo-check -t "$IMAGE:new" .

echo "== Thử OCR =="
# Thiếu thư viện hay model thì worker vẫn Up mà ghi failed cho mọi lượt: thử đúng tiến trình worker sẽ mở.
READY="$(echo '' | docker run --rm -i --entrypoint /app/.venv/bin/python "$IMAGE:new" scripts/ocr-server.py 2>/dev/null | head -1 || true)"
[ "$READY" = '{"ready": true}' ] || { echo "KHÔNG ĐẠT: OCR không sẵn sàng, in ra: $READY" >&2; exit 1; }
echo "  ocr-server: ready"

echo "== Thay $NAME =="
RAM="$(doc_env PHOTO_CHECK_MEMORY 4g)"
SO_CPU="$(doc_env PHOTO_CHECK_CPUS 2)"
# Chờ dừng 150 giây, hơn hạn đọc một ảnh (OCR_TIMEOUT_MS 120 giây): worker làm nốt lượt đang đọc rồi mới thoát.
dung_container "$NAME" 150
docker run -d --name "$NAME" --restart unless-stopped --stop-timeout 150 \
  --memory "$RAM" --memory-swap "$RAM" --cpus "$SO_CPU" \
  "${CHUNG[@]}" "$IMAGE:new" >/dev/null
kiem_worker "$NAME"
docker tag "$IMAGE:new" "$IMAGE:latest"
echo "XONG. $NAME chạy $(git log --oneline -1), trần $RAM RAM, $SO_CPU CPU. Xem log: docker logs -f $NAME"
