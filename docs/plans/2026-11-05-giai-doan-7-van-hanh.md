# Giai đoạn 7: Vận hành và chuẩn bị triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** có trang Vận hành hệ thống, script đo máy chủ, Dockerfile, script backup và tài liệu deploy. Giai đoạn này KHÔNG deploy, KHÔNG SSH vào máy chủ nào, KHÔNG đổi DNS: chủ dự án tự làm theo tài liệu, hoặc nói thẳng khi muốn Claude làm.

**Thiết kế gốc:** Trang 18 và bảng `host_metrics` trong `../Mở tài khoản học sinh qua QR trường.html`. Mẫu trong mgst-app: `src/app/(app)/ops/page.tsx` (tab Máy chủ, khối Kiểm ảnh), `scripts/ops-watch.ts`, `Dockerfile`, `deploy/`, `docs/deploy-fpt-cloud.md`, `scripts/db-backup.ts`, `scripts/db-backup-check.ts`, `scripts/db-restore.ts`, `deploy/systemd/`. Chép phần cần, không import.

## Quyết định đã chốt

- Trang 18 "Vận hành hệ thống" ở nhóm Hệ thống, chỉ Quản trị. Khối Máy chủ: 4 ô CPU, RAM, Ổ đĩa, S3 (phần trăm, thanh đo, đã dùng / tổng, số tệp và lúc đo S3), nhãn chữ khi vượt 80%. Khối Kiểm ảnh: số lượt đang đợi, lượt đợi lâu nhất, bảng theo ngân hàng (Đang đợi, Đạt, Không đạt, Lỗi kiểm) trong khoảng 7 ngày.
- `scripts/ops-watch.ts` chạy thẳng trên máy chủ bằng systemd (không trong container), mỗi 60 giây ghi `host_metrics`, đo S3 mỗi giờ (dung lượng bucket `S3_QUOTA_GB` nếu có), xoá dòng cũ hơn 7 ngày. Không gửi thông báo đẩy.
- Máy chủ FPT Cloud như mgst-app. Docker: tầng app (`bun server.js` của Next standalone), tầng worker (SMS, nén ảnh), tầng kiểm ảnh (Python OCR). Mỗi worker một container. Nginx cho hai tên miền `bank.minhgroup-i.com.vn` và `admin.minhgroup-i.com.vn`, HTTPS, chuyển đúng header Host, giới hạn request theo IP ngưỡng cao (cả trường dùng chung một IP Wi-Fi).
- Backup DB giống mgst-app: script dump, timer systemd, bucket backup riêng, job kiểm bản mới nhất, script khôi phục. Tài liệu ghi bước chạy thử khôi phục.
- Bản test chạy chung máy chủ production, bật tắt khi cần (container và DB riêng, tên miền riêng do chủ dự án chọn).
- Tài liệu `docs/deploy.md` viết tiếng Việt theo quy ước văn phong, lệnh đầy đủ để chép. Ghi rõ bước chủ dự án phải làm: trỏ DNS, tạo bucket production, đặt biến môi trường, chạy migrate, tạo Quản trị đầu tiên, seed tỉnh xã.

## Việc để lại từ giai đoạn trước thuộc giai đoạn này

- `DATABASE_URL` trong shell đè `.env.local`; `db-migrate` phải in DB đang nối (host:port/db) và số migration đã chạy.
- Đổi mật khẩu không giới hạn số lần nhập sai mật khẩu hiện tại.
- Nút Chép mật khẩu không báo gì khi clipboard bị chặn trên http.
- `ipFrom` tin mọi `X-Forwarded-For` (chỉ tin khi sau Nginx, đọc IP cuối do Nginx ghi). Cookie chưa có tiền tố `__Host-`. Phiên hết hạn chưa bị xoá (thêm vào ops-watch hoặc job riêng).

## Task

- [ ] **Task 1: Trang Vận hành và ops-watch.** Nghiệp vụ đọc số đo, Trang 18, script. Test DB: dòng mới nhất, xoá dòng cũ hơn 7 ngày, thống kê kiểm ảnh theo ngân hàng. Test unit hàm đọc `/proc` hoặc `os` (tách hàm thuần).
- [ ] **Task 2: Docker.** `Dockerfile` nhiều tầng, `.dockerignore`, `next.config.ts` bật `output: "standalone"`. Kiểm `docker build --target runner .` chạy được ở local (bỏ qua tầng OCR nếu tải model quá lâu, ghi lại).
- [ ] **Task 3: Backup và khôi phục.** Ba script, unit systemd mẫu ở `deploy/systemd/`. Test: dump DB local ra file, khôi phục vào DB tạm (`createdb` trong container Postgres local), đếm bảng khớp.
- [ ] **Task 4: Tài liệu deploy và Nginx.** `docs/deploy.md`, `deploy/nginx/*.conf`, `deploy/*.sh` dựng từng container. Không chạy lệnh nào trên máy chủ.
- [ ] **Task 5: Việc để lại.** Các mục ở trên, mỗi mục một test.

Cuối giai đoạn chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.
