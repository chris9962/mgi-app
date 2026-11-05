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
- Nginx ghi đè `X-Forwarded-For`; 30 request mỗi giây dồn 600 theo IP; đường gửi ảnh 10 request mỗi giây dồn 300 (sửa theo review lần 1, bản đầu ghi 2 mỗi giây dồn 200); đường tạo hồ sơ thêm vùng 2 mỗi giây dồn 100; file tĩnh không giới hạn; trần body 22 MB.
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
| Khi app import `sharp` (viết lại phần tải ảnh), thêm bước thử nạp `sharp` vào `deploy.sh` như mgst-app | Xong: `deploy.sh` bước 4/7 cho `sharp` đổi một ảnh sang WebP trong image mới (kế hoạch tải ảnh chép mgst-app) |
| Worker SMS chưa nối nhà cung cấp, `send.ts` chỉ ghi log và đánh dấu Đã gửi | Khi có nhà cung cấp SMS |
| Ngưỡng giới hạn request theo IP chưa đo với lượng học sinh thật của một trường | Sau đợt quét QR đầu tiên, đọc `/var/log/nginx/error.log` tìm dòng `limiting requests` |
| Lượt kiểm ảnh ghi failed vì dừng giữa chừng 3 lần không có nút kiểm lại; muốn kiểm lại phải tải ảnh thay thế hoặc gửi lại | Khi user cần |
| Object mồ côi trong `samples/` và `qr/` chưa có job dọn | Khi bucket lớn |
| `db-migrate` không so số migration đã chạy với `drizzle/meta/_journal.json`; mgst-app từng gặp drizzle bỏ qua migration trùng `when` mà vẫn báo xong | Khi có hai nhánh cùng sinh migration |
| Sao lưu chỉ giữ database, không giữ `.env.local`, `.env.backup`, file site Nginx | Chủ dự án giữ bản sao ngoài máy chủ |
| Image worker SMS 736 MB vì cài đủ gói production | Khi đĩa máy chủ chật |

### Sửa theo review lần 1

Reviewer đọc giai đoạn 7 ở commit e1ba023, không thấy lỗi Critical, thấy 6 lỗi Important; người điều phối nâng 2 lỗi Minor lên vì có thể làm mất dữ liệu. Agent sửa trong một lượt ngày 2026-11-05, commit 18e3fd7 tới commit ghi mục này, sau khi phần tải ảnh chép mgst-app (a04b2ae tới af17493) đã vào `dev`. Xen giữa có commit của người điều phối (18529a8, 22bfbce, f9d05d0, ab068e9, b2c222c, 16e99bd), không thuộc lượt sửa này; bộ test cuối chạy sau tất cả. Mỗi mục một commit. Mục có code thì test viết trước, thấy fail đúng lý do rồi mới sửa. Mục script, Nginx thì kiểm bằng test cấu hình hoặc test shell, cộng một lượt chạy thật ở clone tạm, DB tạm, container tạm; mọi thứ của lượt chạy thử đã xoá.

- I1 (18e3fd7): `deploy.sh` thử đăng nhập sai (đọc bảng `users`) ở bước 7 sau migrate, không ở bước 4. Kiểm: test cấu hình `tests/config/deploy.test.ts` (lời gọi `ma_login` đứng sau `bun run db:migrate`, fail trước khi sửa). Chạy thật ở clone tạm có thêm migration giả cột `users.zz_note`: `deploy.sh` của af17493 dừng ở bước 4 với `đăng nhập sai qua DB trả 500` (`column "zz_note" does not exist`), DB không được migrate; bản đã sửa chạy qua, migrate 1 migration mới, bước 7 trả 401.
- I2 (e3a2352): `deploy/lib.sh` kiểm `DATABASE_URL` của `.env.local` trỏ đúng `127.0.0.1:<cổng của môi trường>` ngay lúc nạp rồi export biến đó, nên mọi lệnh `bun` trong `deploy.sh`, `db.sh`, `test-env.sh` (migrate, seed) dùng đúng DB dù shell của root còn giữ URL khác. Kiểm: `tests/config/deployShell.test.ts` chạy `lib.sh` thật trong thư mục tạm với `DATABASE_URL` production trong shell (fail trước khi sửa: `bun` nhận URL production). Chạy thật: `test-env.sh update` trong clone tạm `mgi-bank-test`, shell export URL của một Postgres mồi ở cổng 5436; DB bản test (5437) nhận 9 migration, DB mồi không có schema `drizzle`. `deploy.sh` cũng chạy đúng DB khi shell đặt `DATABASE_URL` sai.
- I3 (bfd0069): `db-restore --that` xoá hẳn database ghi trong `DATABASE_URL` (`drop database ... with (force)`) rồi tạo lại trước khi khôi phục, không dùng `pg_restore --clean`. `dropDatabase` giữ luật chỉ xoá `zz_test_...` và `..._thu`; hàm mới `recreateDatabase` chỉ nhận database của `DATABASE_URL`. Kiểm: `tests/db/backup.test.ts` chạy script thật trên database tạm `zz_test_restore_that_*`, tạo bảng và kiểu sau giờ dump; trước khi sửa cả hai còn nằm lại, sau khi sửa không còn và bảng migration về đúng bản dump. Chạy thật ở clone tạm: lùi theo `docs/deploy.md` mục 9 rồi deploy lại, migration bị lùi được áp lại không lỗi.
- I4 (0de536d): container app có trần RAM `APP_MEMORY`, production mặc định `3g`, bản test `2g`. Đo trên máy local: đổi một ảnh HEIC 8000x6000 (48 MP) bằng `toWebpOnServer` đạt đỉnh 1,22 GB RSS, 10 giây. Kiểm: test cấu hình (fail trước khi sửa); chạy thật `docker inspect` cho 3 GB ở app production thử và 2 GB ở app bản test.
- I5 (6a6639f): vùng gửi ảnh 10 request mỗi giây, dồn 300; đường `POST /api/customers` (B1) thêm vùng riêng 2 mỗi giây, dồn 100. Kiểm: test cấu hình tính tải 300 học sinh x 6 ảnh trong 10 phút (fail trước khi sửa: 1.400 so với 3.600 cần). Chạy thật bằng `nginx:alpine`: 240 ảnh cùng lúc qua hết, 4 ảnh mỗi giây trong 60 giây qua hết, 40 hồ sơ cùng lúc qua hết, 300 hồ sơ liền nhau từ một máy chỉ 103 qua. Sửa câu ruling cũ "đường gửi ảnh 2 mỗi giây dồn 200".
- I6 (4b901a7): Nginx gửi `Strict-Transport-Security: max-age=31536000` qua https ở mọi phản hồi, kể cả hai location bảo trì vốn tự đặt `add_header`; không gửi qua http. Kiểm: test cấu hình (fail trước khi sửa); `nginx:alpine` với chứng chỉ tự ký: https trả header ở trang, API, trang bảo trì 503, JSON bảo trì 503; http không có header.
- M7 nâng lên (1f68aa8): job dọn ảnh mồ côi dừng, không xoá ảnh nào, thoát mã 1 khi DB không có dòng `proof_photos` mà bucket còn ảnh cũ, hoặc hơn 20 ảnh và hơn 10% ảnh cũ không dòng nào trỏ tới. Cờ `--bo-chan` xoá sau khi người vận hành xem `--dry-run`. Kiểm: `tests/unit/orphanGuard.test.ts`; `tests/s3/orphans.test.ts` ghi 25 ảnh không dòng nào trỏ tới vào thư mục `proofs/2099-01-02/` của bucket dev (trước khi sửa job xoá cả 25; sau khi sửa job dừng, 25 ảnh còn nguyên, `force` mới xoá).
- M8 nâng lên (63596e4): `db-backup.ts` dừng trước khi đẩy lên S3 và trước khi dọn bản cũ khi bản dump mới nhỏ hơn nửa bản mới nhất trên S3; `BACKUP_ALLOW_SHRINK=1` cho một lượt chạy tay. Sửa comment của `dumpDatabase`: bước đọc mục lục chỉ chứng minh file đọc được và có mục dữ liệu bảng `users`, không chứng minh có dòng. Kiểm: `tests/unit/backup.test.ts` (fail trước khi sửa vì chưa có hàm). Không chạy thật cả script: cần bucket sao lưu khác bucket ảnh, agent chỉ được dùng `mgi-bank-dev`.

Ruling mới:

- Thử đăng nhập sai chỉ ở bước 7, sau migrate. Bước thử image ở cổng phụ không còn đường nào đọc DB; image hỏng đường DB thì lộ ở bước 7 và script tự lùi.
- `lib.sh` export `DATABASE_URL` của `.env.local` thay vì `unset`, để lệnh `bun` nhận đúng giá trị đã kiểm dù package script đọc `.env.local` hay không.
- Trần RAM app 3 GB đủ hai ảnh HEIC 48 MP đổi cùng lúc; bản test 2 GB đủ một ảnh. Vượt trần thì Docker dừng app rồi chạy lại, request đang dở lỗi.
- Ngưỡng ảnh 10 mỗi giây dồn 300 tính cho 300 học sinh chung một IP, mỗi em tới 6 ảnh trong 10 phút, gấp đôi để dư. Ngưỡng tạo hồ sơ 2 mỗi giây dồn 100.
- HSTS 1 năm, không `includeSubDomains`, không `preload`, đặt trong repo thay vì cờ `--hsts` của certbot.
- Chốt chặn dọn ảnh: hơn 20 ảnh và hơn 10% ảnh cũ, hoặc DB không có dòng nào.
- Chốt sao lưu: so dung lượng với bản mới nhất trên S3, ngưỡng một nửa, không so số dòng từng bảng.

Ghi cho chủ dự án: thiết kế ghi "mỗi lần xem ảnh ghi `audit_log`". Bản hiện tại ghi một dòng cho mỗi người, mỗi ảnh, mỗi 10 phút (hạn link xem ảnh). Lý do: Trang 4 tải lại mọi ảnh mỗi lần mở, bảng `audit_log` phình theo số lần tải trang. Chủ dự án muốn ghi đủ mọi lần xem thì bỏ câu kiểm 10 phút ở `photoForView`.

Test sau lần sửa: `bun run test` 211 pass, `bun test:db` 199 pass, `bun test:s3` 29 pass, `bun run e2e` 19 pass, `bunx tsc --noEmit` sạch, `bun run lint` 0 lỗi (2 cảnh báo `<img>` cũ). Dữ liệu của chủ dự án trong DB local giữ nguyên trước và sau mọi lượt chạy: 13 ngân hàng (12 thật và ZZVPB), 61 khung ảnh, trường ZZDEMO, 9 mã `ND-*`, tài khoản `admin`, 3 hồ sơ thử ở ZZDEMO với 2 dòng ngân hàng và 12 ảnh.

Việc để lại thêm (Minor của review lần 1, chưa sửa):

| Việc | Khi nào |
|---|---|
| `deploy.sh` để bảo trì bật khi migrate hoặc `docker run` lỗi; cần `trap` tắt bảo trì | Khi sửa `deploy.sh` |
| `db:restore` từ file trên đĩa vẫn đòi `.env.backup` | Khi sửa `db-restore.ts` |
| Khôi phục đè không dừng `mgi-bank-ops-watch` và `mgi-bank-s3-orphans` | Khi sửa `db-restore.ts`; tạm thời người vận hành chạy `systemctl stop` hai unit đó |
| Comment ở `src/server/http/ip.ts:3` và tên test ở `tests/unit/ip.test.ts:7` nói Nginx "nối" `X-Forwarded-For`; Nginx nay ghi đè | Khi sửa file đó |
| Chưa có khối `default_server` cho cổng 443 khi chung máy với mgst-app: Host lạ có thể rơi vào site của hệ kia | Lúc cài Nginx trên máy chủ |
| Thiết kế ghi Nginx chặn `/api/admin` trên tên miền học sinh (nay chỉ app chặn) và có `GET /api/admin/ops` (không có route này, Trang 18 đọc thẳng ở máy chủ) | Khi cập nhật thiết kế |
| `app.conf` ghi cứng đường dẫn `/opt/mgi-bank` cho `proxy.conf`, bản test dùng chung; hai môi trường dùng chung vùng giới hạn request | Khi bản test cần cấu hình riêng |
| Bản dump trước deploy ở `/root` không bao giờ được dọn | Khi đĩa máy chủ chật |
| `docs/deploy.md`: vài cảnh báo đặt sau bước (mục 8, mục 12), thiếu bước kiểm `timedatectl` (timer và tên file sao lưu theo giờ máy chủ), vài câu dài ở mục 6 | Khi sửa tài liệu |
| Ô Ổ đĩa của Trang 18 tính theo tổng phân vùng, không trừ 5% dành cho root | Khi user cần |
| Mật khẩu DB lộ trong tham số `docker run` của `db.sh` (`docker inspect` đọc được) | Khi siết bảo mật máy chủ |
| Cờ gõ sai kiểu `--truog=` bị bỏ qua im lặng (chỉ cờ bắt đầu bằng `--truong` bị kiểm) | Khi sửa worker |
| Ô tên ngân hàng trong bảng Kiểm ảnh nên là `th scope="row"`; nhãn "Vượt 80%" hiện cả khi đúng 80% | Khi sửa Trang 18 |
