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
- Từ review lần 2 giai đoạn 6, mỗi mục một test:
  - `src/server/ocr/reader.ts:74-78`, `:101-105`: lượt hết giờ lúc tiến trình Python đang mở thì `.catch` đặt `server = null` sau khi lượt kế đã mở tiến trình mới, nên một tiến trình 1 đến 2 GB bị bỏ sót. Chỉ đặt `null` khi `server` còn là đúng promise đó.
  - `src/server/photoCheckWorker.ts:53`: worker kiểm ảnh tải S3 không có hạn giờ; S3 treo thì hàng chờ kiểm ảnh dừng và SIGTERM không thoát được. Nên đặt hạn giờ cho mọi lệnh S3 ở `src/server/storage.ts`.
  - `src/server/photoCheckWorker.ts:54`: đổi HEIC không có trần RAM; worker chết thì lượt được nhận lại mỗi 5 phút mãi. Lượt kiểm phải có số lần nhận tối đa rồi ghi `failed`, và container đặt RAM đủ cho HEIC 48 MP (khoảng 1,2 GB).
  - `src/server/compress.ts:69-73`, `:111`: nhánh giữ file của `removeIfUnused` chưa có test (ca câu ghi kết quả ném lỗi sau khi webp ghi đè đúng khoá cũ).
  - `src/server/compress.ts:13`: comment ghi trần 100 MP chặn được ảnh 48 MP, nhưng `heic-convert` giải mã đủ ảnh trước khi sharp kiểm trần.
  - `src/server/workerScope.ts:14-19`: cờ `--truong <id>` có dấu cách hoặc gõ sai tên cờ bị bỏ qua, worker xử lý toàn bộ DB. Tham số bắt đầu bằng `--truong` mà không đọc được thì dừng với lỗi.
- Các mục "Giai đoạn 7" trong bảng "Việc để lại" của kế hoạch giai đoạn 4, 5, 6 (CORS và lifecycle `uploads/`, object mồ côi, `created_ip`, `VOUCHER_SECRET`, `unaccent`, container worker SMS, audit xem ảnh, container OCR và stop grace).

## Task

- [x] **Task 1: Trang Vận hành và ops-watch.** Nghiệp vụ đọc số đo, Trang 18, script. Test DB: dòng mới nhất, xoá dòng cũ hơn 7 ngày, thống kê kiểm ảnh theo ngân hàng. Test unit hàm đọc `/proc` hoặc `os` (tách hàm thuần).
- [x] **Task 2: Docker.** `Dockerfile` nhiều tầng, `.dockerignore`, `next.config.ts` bật `output: "standalone"`. Kiểm `docker build --target runner .` chạy được ở local (bỏ qua tầng OCR nếu tải model quá lâu, ghi lại).
- [x] **Task 3: Backup và khôi phục.** Ba script, unit systemd mẫu ở `deploy/systemd/`. Test: dump DB local ra file, khôi phục vào DB tạm (`createdb` trong container Postgres local), đếm bảng khớp.
- [x] **Task 4: Tài liệu deploy và Nginx.** `docs/deploy.md`, `deploy/nginx/*.conf`, `deploy/*.sh` dựng từng container. Không chạy lệnh nào trên máy chủ.
- [x] **Task 5: Việc để lại.** Các mục ở trên, mỗi mục một test.

Cuối giai đoạn chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.

## Kết quả

Agent làm xong 5 task ngày 2026-11-05, commit 0d07228 tới commit ghi mục này, trên nhánh `dev`. Agent làm Task 5 trước Task 4 để tài liệu deploy mô tả đúng code cuối.

### Đổi phạm vi giữa giai đoạn

Người điều phối báo ngày 2026-11-05: ngay sau giai đoạn 7, cơ chế tải ảnh viết lại theo mgst-app. Ảnh gửi qua API của app (POST multipart), `putImage` đổi sang webp ngay lúc ghi. Không còn presigned PUT cho ảnh học sinh, thư mục `uploads/`, CORS cho tên miền học sinh, worker nén. Một agent khác làm phần đó. Giai đoạn 7 không dựng container worker nén và không sửa đường tải ảnh, nén ảnh.

### Đã làm

- Task 1: Trang 18 Vận hành hệ thống ở nhóm Hệ thống, chỉ Quản trị (`src/app/admin/(shell)/ops/page.tsx`, nghiệp vụ `src/server/ops.ts`). Khối Máy chủ có 4 ô CPU, RAM, Ổ đĩa, S3, thanh đo, nhãn "Vượt 80%". Khối Kiểm ảnh có số lượt đang đợi, lượt đợi lâu nhất, bảng theo ngân hàng trong 7 ngày. `scripts/ops-watch.ts` ghi `host_metrics` mỗi 60 giây, đo S3 mỗi giờ, xoá số đo cũ hơn 7 ngày và phiên hết hạn. Hàm đọc `/proc` tách ở `src/server/hostProbe.ts`.
- Task 2: `Dockerfile` nhiều tầng: `runner` (Next standalone, `bun server.js`, đứng cuối file), `sms-worker`, `photo-check` (Python OCR, model tải lúc dựng). `.dockerignore` chặn `.env*`. `next.config.ts` bật `output: "standalone"`.
- Task 3: `scripts/db-backup.ts`, `scripts/db-backup-check.ts`, `scripts/db-restore.ts`, phần dùng chung ở `scripts/lib/backup.ts`. Unit systemd ở `deploy/systemd/`: sao lưu, kiểm sao lưu, ops-watch, dọn ảnh mồ côi, báo động.
- Task 4: `docs/deploy.md`, `deploy/nginx/` (limits, app, proxy, mẫu site production và bản test), `deploy/db.sh`, `deploy/deploy.sh`, `deploy/worker-photo.sh`, `deploy/worker-sms.sh`, `deploy/jobs.sh`, `deploy/test-env.sh`, trang bảo trì. `AGENTS.md` thêm dòng trỏ tới `docs/deploy.md`.
- Task 5, mỗi mục một test:
  - `db-migrate` in database đang nối và số migration mới, chạy được trên database mới tinh (`tests/db/migrate.test.ts`).
  - Đổi mật khẩu dùng chung bộ đếm sai với đăng nhập, sai 5 lần thì khoá 15 phút (`tests/db/profile.test.ts`).
  - Nút Chép mật khẩu báo "Không chép được." và chọn sẵn mật khẩu khi clipboard bị chặn (e2e `auth.spec.ts`).
  - `ipFrom` và `created_ip` lấy địa chỉ cuối của `X-Forwarded-For`; Nginx ghi đè header này (`tests/unit/ip.test.ts`, `tests/db/studentRoutes.test.ts`).
  - Cookie phiên `__Host-mgi_session` khi có Secure (`tests/unit/cookie.test.ts`).
  - Phiên hết hạn bị xoá ở mỗi vòng ops-watch (`tests/db/ops.test.ts`).
  - `reader.ts` không bỏ sót tiến trình Python khi lượt hết giờ lúc tiến trình đang mở (`tests/unit/ocrReader.test.ts`).
  - Mọi lệnh S3 ở `storage.ts` có hạn giờ `S3_TIMEOUT_MS` (`tests/unit/storage.test.ts`).
  - Lượt kiểm ảnh nhận tối đa 3 lần rồi ghi failed, migration 0006 (`tests/db/photoCheck.test.ts`). Container kiểm ảnh trần 4 GB RAM.
  - Cờ `--truong` gõ sai thì worker dừng (`tests/unit/workerFlags.test.ts`).
  - Xem ảnh ở Trang 4: một người, một ảnh, trong 10 phút chỉ ghi một dòng audit, migration 0007 (`tests/db/customerDetail.test.ts`).
  - Job 03:30 xoá ảnh trong `proofs/` cũ hơn 24 giờ mà không dòng nào trỏ tới (`tests/s3/orphans.test.ts`).
  - `VOUCHER_SECRET`, `unaccent`, RAM và chờ dừng của container, worker SMS: `deploy/deploy.sh` dừng khi thiếu biến, `docs/deploy.md` mục 4, 5, 7, test cấu hình `tests/config/deploy.test.ts`.
  - Mục "Ô tìm chưa thoát `%` `_`" đã làm ở giai đoạn 5 (`tests/db/search.test.ts`).

### Kiểm ở local

- `docker build --target runner .` đạt, image 201 MB. Container thử: `/login` trả 200 với Host quản lý, 404 với Host lạ, CSS tĩnh 200, healthcheck `healthy`, chạy bằng user `mgi`, đăng nhập sai trả 401 (nối được DB).
- `docker build --target sms-worker .` đạt, 736 MB. Container chạy, giờ +07, SIGTERM thoát mã 0.
- `docker build --target photo-check .` hỏng trên máy Mac arm64: `paddlepaddle==3.3.1` không có bánh xe linux aarch64. Dựng bằng `--platform linux/amd64` đạt, 4,17 GB, `ocr-server.py` trả `{"ready": true}` sau 16 giây.
- Nginx thử bằng `nginx:alpine` nạp ba file của repo: kết quả ghi ở `docs/deploy.md` mục 6.
- Chạy thử script deploy trong clone tạm với tên `zz-mgi-thu`: `db.sh`, migrate, seed, tạo Quản trị, `deploy.sh` hai lượt, đăng nhập thật nhận cookie `__Host-` có Secure, Trang 18 hiện, `db:restore --thu` và `--that`, `worker-sms.sh`, `worker-photo.sh`. Lượt thử bắt được lỗi `db-migrate` trên database mới tinh, đã sửa ở 8608a94. Đã xoá mọi container, mạng, volume, image của lượt thử.
- `deploy/jobs.sh` và `deploy/test-env.sh` chỉ kiểm cú pháp và shellcheck: macOS không có systemd, bản test đòi thư mục `/opt/mgi-bank-test`.

### Ruling

- Không dựng container, script cho worker nén; bỏ các mục chỉ có vì cơ chế presigned và nén (theo người điều phối).
- `schoolsFlag` sửa ở file dùng chung, worker nén nhận luật chặt theo, không sửa file nén.
- Phiên hết hạn dọn trong ops-watch, không làm job riêng.
- Bảng Kiểm ảnh chép luật mgst-app: chỉ lượt mới nhất của mỗi dòng ngân hàng trong 7 ngày lịch giờ Việt Nam; Đang đợi không kẹp ngày; khoảng 7 ngày cố định.
- Thiếu `S3_QUOTA_GB` thì ô S3 hiện dung lượng làm số lớn, không thanh đo; chưa đo thì hiện "Chưa đo".
- Trang 18 tự tải lại mỗi 60 giây như mgst-app.
- Phiên bản Python của tầng kiểm ảnh giữ đúng mgst-app vì máy chủ là x86_64.
- Tầng app đứng cuối `Dockerfile`.
- Không thêm bước thử `sharp` vào `deploy.sh` vì app hiện không import `sharp`.
- Sao lưu mỗi giờ 06:00 tới 23:00, giữ 7 ngày trên S3, 18 file trên đĩa; kiểm file dump bằng `pg_restore --list` thay ngưỡng dung lượng.
- `db-restore --that` từ chối khi container app, worker còn chạy (tên lấy theo container DB), chờ 10 giây, nhận cả file dump trên đĩa.
- Cookie `__Host-mgi_session` chỉ khi Secure bật; local http và `COOKIE_SECURE=false` giữ `mgi_session`.
- Đổi mật khẩu dùng chung khoá 15 phút với đăng nhập; phiên đang dùng không bị cắt.
- "Mỗi lần xem ảnh ghi audit" hiểu là mỗi lần xem trong hạn link 10 phút.
- Job dọn ảnh mồ côi chỉ quét `proofs/`, giữ object mới hơn 24 giờ.
- Thiếu `OCR_PYTHON` không sửa code: image đặt biến, script deploy thử OCR trước khi thay container.
- Cổng 3200, 3201, 5436 cho production, 3210, 5437 cho bản test, tránh cổng của mgst-app.
- App và worker gọi DB bằng tên container trong mạng Docker riêng, không dùng `host.docker.internal`.
- Nginx ghi đè `X-Forwarded-For`; 30 request mỗi giây dồn 600 theo IP; đường gửi ảnh 2 mỗi giây dồn 200; file tĩnh không giới hạn; trần body 22 MB.
- `worker-sms.sh` đòi cờ `--chap-nhan-chi-ghi-log` khi chưa nối nhà cung cấp SMS.
- Bản test chỉ chạy app và DB, bucket riêng, app trần 1 GB.
- Trang bảo trì bỏ đếm ngược, tự tải lại mỗi 30 giây.
- `jobs.sh` chỉ bật timer sao lưu khi có `.env.backup`.

### Test

`bun run test` 193 pass, `bun test:db` 195 pass, `bun test:s3` 34 pass, `bun run e2e` 18 pass, `bunx tsc --noEmit` sạch, `bun run lint` 0 lỗi (2 cảnh báo `<img>` cũ). Chạy lại `test:db` và e2e sau khi người điều phối thêm 12 ngân hàng của chủ dự án vào DB local: vẫn đạt, 12 ngân hàng còn nguyên.

### Việc để lại

| Việc | Lý do, khi nào |
|---|---|
| CORS cho `STUDENT_ORIGIN`, `s3-cors.ts` ghi đè CORS | Bỏ: cơ chế tải ảnh đổi sang chép mgst-app |
| Lifecycle xoá `uploads/` sau 1 ngày, object mồ côi trong `uploads/` | Bỏ: cơ chế tải ảnh đổi sang chép mgst-app |
| Test nhánh giữ file của `removeIfUnused`, comment trần 100 MP ở `compress.ts:13` | Bỏ: cơ chế tải ảnh đổi sang chép mgst-app |
| RAM của `heic-convert` trong worker nén, container worker nén | Bỏ: cơ chế tải ảnh đổi sang chép mgst-app |
| Quay lại từ B3 và lỗi kết nối sau khi ghi kết quả nén làm object `.webp` hoặc ảnh gốc thành rác | Bỏ: cơ chế tải ảnh đổi sang chép mgst-app; job dọn `proofs/` vẫn xoá phần còn sót |
| Deploy thật: DNS, CAA, bucket production và bucket sao lưu, `.env.local`, migrate, seed, tạo Quản trị, Nginx, certbot, `jobs.sh`, diễn tập khôi phục | Cần máy chủ và tài khoản của chủ dự án; lệnh đầy đủ ở `docs/deploy.md` |
| `deploy/jobs.sh`, `deploy/test-env.sh` chưa chạy thật | Cần systemd và thư mục `/opt/mgi-bank-test` trên máy chủ |
| Tầng kiểm ảnh mới dựng bằng giả lập amd64 trên máy Mac | Lần dựng đầu trên máy chủ x86_64 |
| Khi app import `sharp` (viết lại phần tải ảnh), thêm bước thử nạp `sharp` vào `deploy.sh` như mgst-app | Khi viết lại phần tải ảnh |
| Worker SMS chưa nối nhà cung cấp, `send.ts` chỉ ghi log và đánh dấu Đã gửi | Khi có nhà cung cấp SMS |
| Ngưỡng giới hạn request theo IP chưa đo với lượng học sinh thật của một trường | Sau đợt quét QR đầu tiên, đọc `/var/log/nginx/error.log` tìm dòng `limiting requests` |
| Lượt kiểm ảnh ghi failed vì dừng giữa chừng 3 lần không có nút kiểm lại; muốn kiểm lại phải tải ảnh thay thế hoặc gửi lại | Khi user cần |
| Object mồ côi trong `samples/` và `qr/` chưa có job dọn | Khi bucket lớn |
| `db-migrate` không so số migration đã chạy với `drizzle/meta/_journal.json`; mgst-app từng gặp drizzle bỏ qua migration trùng `when` mà vẫn báo xong | Khi có hai nhánh cùng sinh migration |
| Sao lưu chỉ giữ database, không giữ `.env.local`, `.env.backup`, file site Nginx | Chủ dự án giữ bản sao ngoài máy chủ |
| Image worker SMS 736 MB vì cài đủ gói production | Khi đĩa máy chủ chật |
