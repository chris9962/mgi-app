# Image của mgi-bank, chép cách làm của mgst-app. Dựng từng tầng một bằng --target, không dựng song song trên máy chủ:
#   docker build --target runner -t mgi-bank-app:new .          app, bun server.js của Next standalone
#   docker build --target sms-worker -t mgi-bank-sms:new .      worker SMS
#   docker build --target photo-check -t mgi-bank-photo:new .   worker kiểm ảnh, Python OCR
# Tầng app đứng cuối file: quên --target thì vẫn ra app, không ra worker.
# Image không chứa .env.local, migration hay script vận hành: máy chủ truyền env bằng --env-file, chạy migrate từ repo.

FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN bun install --frozen-lockfile

FROM oven/bun:1.3-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Giá trị giả chỉ sống trong tầng dựng: next build nạp module máy chủ, src/server/db/client.ts ném lỗi nếu thiếu biến này. Bản dựng không truy vấn DB.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
# Không dùng RUN --mount=type=cache: máy chủ FPT có thể thiếu buildx, builder cổ điển từ chối cú pháp đó.
RUN bun run build

# Worker SMS: nghe kênh sms_messages. Nền alpine như app, chỉ cần gói production.
FROM oven/bun:1.3-alpine AS sms-worker
WORKDIR /app
# Alpine không mang bảng múi giờ: thiếu tzdata thì ENV TZ vô tác dụng, log in giờ UTC.
RUN apk add --no-cache tzdata
COPY package.json bun.lock ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN bun install --frozen-lockfile --production
COPY tsconfig.json ./
COPY src ./src
COPY scripts/sms-worker.ts ./scripts/
ENV TZ=Asia/Ho_Chi_Minh
USER bun
ENTRYPOINT ["bun", "scripts/sms-worker.ts"]

# Worker kiểm ảnh: PaddleOCR dò vùng, VietOCR đọc chữ. Nền debian vì torch và paddle chỉ có bánh xe glibc.
# Lần dựng đầu tải khoảng 1,5 GB gói và model; các lần sau Docker giữ cache tầng Python, chỉ dựng lại mã nguồn.
FROM oven/bun:1.3-debian AS photo-check
WORKDIR /app
# libgl1, libglib2.0-0: opencv của paddleocr cần. libgomp1: paddle cần.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv libgl1 libglib2.0-0 libgomp1 tzdata \
  && rm -rf /var/lib/apt/lists/*
# Phiên bản chép từ mgst-app (chạy thật từ 2026-09-19). torch lấy từ kho CPU: bản PyPI kèm CUDA nặng thêm 700 MB.
# setuptools<70 vì gdown (vietocr kéo theo) còn import pkg_resources.
RUN python3 -m venv /app/.venv \
  && /app/.venv/bin/pip install --no-cache-dir "setuptools<70" \
  && /app/.venv/bin/pip install --no-cache-dir torch==2.14.0 torchvision==0.29.0 --index-url https://download.pytorch.org/whl/cpu \
  && /app/.venv/bin/pip install --no-cache-dir paddlepaddle==3.3.1 paddleocr==3.7.0 vietocr==0.3.12
ENV OCR_PYTHON=/app/.venv/bin/python
# Model tải lúc dựng vào /app/.models: container chạy không cần mạng, VietOCR mặc định tải lại cấu hình mỗi lần mở.
ENV PADDLE_PDX_CACHE_HOME=/app/.models/paddlex \
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True
COPY scripts/ocr-server.py ./scripts/
RUN /app/.venv/bin/python scripts/ocr-server.py --tai-model /app/.models
ENV OCR_CONFIG=/app/.models/vgg_transformer.yml \
    OCR_WEIGHTS=/app/.models/vgg_transformer.pth \
    OCR_THREADS=2 \
    OMP_NUM_THREADS=2
COPY package.json bun.lock ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# Cài lại trên debian: sharp có phần native, bản musl của tầng alpine không chạy trên glibc.
RUN bun install --frozen-lockfile --production
COPY tsconfig.json ./
COPY src ./src
COPY scripts/photo-check-worker.ts ./scripts/
ENV TZ=Asia/Ho_Chi_Minh
RUN chown -R bun:bun /app/.models
USER bun
ENTRYPOINT ["bun", "scripts/photo-check-worker.ts"]

# App: .next/standalone cộng public và .next/static. Thiếu .next/static thì mọi JS, CSS trả 404, trang trắng.
FROM oven/bun:1.3-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Không chạy bằng root: lỗi thoát container không thành quyền root trên máy chủ. Mã nguồn thuộc root nên tiến trình không ghi đè được.
RUN addgroup -S mgi && adduser -S -G mgi mgi
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Standalone chép thiếu thư viện libvips của sharp (bài học của mgst-app 2026-09-05): chép trọn @img.
COPY --from=builder /app/node_modules/@img ./node_modules/@img
RUN mkdir -p .next/cache && chown -R mgi:mgi .next/cache
USER mgi
EXPOSE 3000
# Proxy trả 404 cho Host lạ, nên healthcheck phải gửi Host là tên miền quản lý như Nginx.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO /dev/null --header "Host: ${ADMIN_HOST:-admin.localhost}" http://127.0.0.1:3000/login || exit 1
CMD ["bun", "server.js"]
