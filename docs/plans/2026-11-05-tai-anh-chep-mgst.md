# Tải ảnh chép cơ chế mgst-app

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** mọi ảnh đi qua API của app. Máy chủ đổi ảnh sang WebP ngay lúc nhận, giống mgst-app. Bỏ presigned PUT cho ảnh học sinh, thư mục `uploads/`, CORS cho web học sinh và worker nén.

**Lý do:** chủ dự án chốt 2026-11-05: "tôi đã nói cơ chế upload ảnh copy mgst qua". Giai đoạn 4 và 6 làm theo cách khác (điện thoại tải thẳng S3, worker nén sau). Kế hoạch này đổi lại cho đúng.

**Thiết kế gốc:** luật "B3 gửi ảnh" và "Đổi WebP lúc nhận" ở mục `id="du-lieu"` của `../Mở tài khoản học sinh qua QR trường.html` (đã sửa ngày 2026-11-05). Quyết định ở mục "Tải ảnh chép mgst-app" của `../du-an-mo-tai-khoan-hoc-sinh/cau-hoi-kien-truc-2026-11-03.md`.

**Mẫu mgst-app (chép, không import, không sửa mgst-app):** `src/server/storage.ts` hàm `putImage`, `src/server/toWebpOnServer.ts`, `src/app/api/uploads/route.ts`, `src/lib/toWebpImage.ts`.

## Quyết định đã chốt

- Điện thoại vẫn nén bằng `src/lib/compressImage.ts`. Trình duyệt không mở được ảnh (HEIC trên Chrome Android) thì gửi nguyên file.
- `putImage` ở `src/server/storage.ts` chép cách làm của mgst-app. Hàm kiểm chữ ký file, gọi bản chép `toWebpOnServer`, rồi ghi S3:
  - cạnh dài tối đa 1600, trần 300 KB, bậc chất lượng 85, 80, 75, 70;
  - HEIC đi qua `heic-convert`, không đưa thẳng cho sharp;
  - ảnh đã là WebP trong trần thì giữ nguyên;
  - đổi lỗi thì giữ ảnh gốc;
  - trần file nhận vào 20 MB như mgst-app.
- Mọi đường tải ảnh gọi `putImage`: ảnh học sinh ở B3, ảnh thay thế ở Trang 4, ảnh mẫu, ảnh QR.
- `POST /api/customers/me/photos` nhận multipart: file ảnh và khung ảnh (ngân hàng, khung). Máy chủ giữ mọi điều kiện kiểm của `recordPhoto` hiện tại: hồ sơ chưa gửi, khung thuộc ngân hàng đã chọn, trường còn mở, khoá dòng như cũ. Ảnh cũ của khung bị thay thì xoá trên S3 sau khi commit.
- Ghi S3 trước, ghi DB sau. DB lỗi thì xoá object vừa ghi.
- Bỏ: route `POST /api/customers/me/photos/upload-url`, `presignPut`, thư mục `uploads` trong `src/lib/imageKey.ts`, `scripts/s3-cors.ts` và biến chỉ CORS dùng. `copyImage`, `headSize` bỏ nếu không còn chỗ nào dùng.
- Bỏ worker nén: `scripts/compress-worker.ts`, `src/server/compress.ts`, script trong `package.json`, test của worker nén. Migration mới bỏ các cột `compressed_at`, `compress_attempts`, `compress_tried_at` và chỉ mục hàng chờ nén của `proof_photos`. Production chưa có dữ liệu.
- Worker kiểm ảnh giữ nhánh đổi HEIC sang JPEG, vì ảnh đổi lỗi vẫn giữ bản gốc.
- Nginx: `client_max_body_size 20m` cho cả hai tên miền. Kiểm `docs/deploy.md` và Dockerfile của giai đoạn 7 không còn nhắc worker nén, CORS hay `uploads/`.
- Màn B3 giữ nguyên chữ và cách hiện "Đang tải ảnh".

## Task

- [ ] **Task 1: `putImage` đổi WebP lúc nhận.** Chép `toWebpOnServer`. Test unit hoặc S3: PNG lớn thành WebP dưới 300 KB, cạnh dài 1600; WebP nhỏ giữ nguyên byte; HEIC thành WebP; file hỏng mang chữ ký ảnh thì giữ bản gốc; file quá 20 MB bị từ chối; file không phải ảnh bị từ chối.
- [ ] **Task 2: B3 gửi file qua API.** Route multipart, nghiệp vụ ở `src/server/customerPhotos.ts`, `PhotoSlot.tsx` gửi file. Bỏ route xin link PUT. Test DB và S3: ảnh nộp xong có khoá `.webp` trong `proofs/`; hồ sơ đã gửi, khung không thuộc ngân hàng đã chọn, trường đã đóng đều bị từ chối và không để lại object; chụp lại xoá ảnh cũ; hai lần gửi cùng khung song song chỉ còn một dòng. E2E B3 chạy lại.
- [ ] **Task 3: Ảnh thay thế, ảnh mẫu, ảnh QR.** Ba đường đều qua `putImage` mới. Test: nhân viên tải HEIC làm ảnh thay thế thì dòng ảnh mới có khoá `.webp`, lượt kiểm ảnh đọc được.
- [ ] **Task 4: Bỏ worker nén và phần thừa.** Migration bỏ cột, bỏ code, script, test, biến môi trường. Sửa `docs/deploy.md`, Dockerfile, `deploy/` nếu còn nhắc. Ghi bảng "Việc để lại" của kế hoạch giai đoạn 4, 6, 7: các mục về `uploads/`, CORS, worker nén chuyển thành "Bỏ: tải ảnh chép mgst-app".

Cuối kế hoạch chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.
