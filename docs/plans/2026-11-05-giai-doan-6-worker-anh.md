# Giai đoạn 6: Worker nén ảnh và kiểm ảnh

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** ảnh học sinh nộp được nén lại ở máy chủ; máy đọc chữ trên ảnh và báo khung nào thấy đủ họ tên, mã giới thiệu.

**Thiết kế gốc:** luật "Worker nén ảnh", "Xếp lượt kiểm ảnh", "Worker kiểm ảnh" ở mục `id="du-lieu"` của `../Mở tài khoản học sinh qua QR trường.html`. Code tham khảo trong mgst-app: `scripts/photo-check-worker.ts`, `src/server/photoCheck.ts`, `src/server/ocr/reader.ts`, `src/server/ocr/text.ts`, `src/server/ocr/facts.ts`, `scripts/ocr-server.py`, `src/components/banking/PhotoCheckPanel.tsx`. Chép, không import.

## Quyết định đã chốt

- Worker nén: ảnh có `compressed_at` rỗng và `compress_attempts < 3`. Ảnh quá 300 KB hoặc chưa phải webp thì tải về, ép webp cạnh dài 1600 (`sharp`, HEIC qua `heic-convert`), ghi lên S3. Ảnh đã đạt thì chỉ ghi `compressed_at`. Lỗi 3 lần thì giữ ảnh gốc. Đổi đuôi khoá thì cập nhật `s3_key` và xoá object cũ, ghi ruling nếu chọn cách khác.
- Kiểm ảnh chỉ kiểm họ tên và mã giới thiệu, không kiểm số tài khoản. Mỗi khung bật `check_name`, `check_code` ở hộp thoại Hướng dẫn. Worker chỉ đọc ảnh đang dùng của đúng khung đó, không đoán màn, không tìm sang ảnh khác.
- Họ tên so với `customers.full_name` sau khi bỏ dấu, viết hoa, bỏ khoảng trắng; đúng từng chữ cái; dòng chữ trên ảnh được dư tối đa 2 chữ cái mỗi đầu (chép `lineHasName`).
- Mã giới thiệu so nguyên văn với `customer_banks.referral_code`, chỉ bỏ dấu và viết hoa; không gộp O với 0, I với 1; trước sau mã không dính chữ hay số (chép `linesHaveExactCode`). Mã có O, I, 0, 1 thì đọc lại vùng đó bằng model thứ hai như mgst-app. Không cho sai ký tự.
- Không trích giá trị trên ảnh để hiện. Không thấy thì ghi "Không tìm thấy ..." kèm giá trị hệ thống.
- Hàng chờ `photo_checks`: Gửi kiểm tra, Tải ảnh thay thế, sửa họ tên đều xếp lượt (xoá dòng pending cũ của dòng ngân hàng đó, thêm dòng mới, `pg_notify`). Thêm unique `(customer_bank_id) where status = 'pending'`. Worker nghe `LISTEN`, quét lại mỗi 30 giây, mỗi vòng 20 lượt. Lượt bị thay trong lúc đọc thì bỏ kết quả. Lỗi máy thì ghi `failed` kèm lý do, không thử lại.
- `result` jsonb: mỗi khung có bật kiểm một mục (khung, tên khung, giá trị hệ thống, đạt hay không, câu lý do). `passed`, `total` là số khung đạt trên số khung có bật kiểm.
- Kết quả chỉ để gợi ý, worker không đổi trạng thái `customer_banks`. Học sinh không thấy kết quả.
- Giao diện: khối "Xác thực ảnh" trong khối ngân hàng ở Trang 4 (mỗi khung một dòng Đạt hoặc Không đạt, "Hệ thống: ...", câu lý do, thời điểm kiểm), dòng "Xác thực ảnh x/y" ở Trang 3, bộ lọc kết quả xác thực ảnh ở Trang 3.
- Môi trường OCR local: `OCR_PYTHON=~/.mgst-ocr/bin/python` (Python 3.11 có sẵn PaddleOCR, VietOCR). Worker chạy container riêng ở giai đoạn 7.

## Việc để lại từ giai đoạn trước thuộc giai đoạn này

- `photo_checks` chưa có unique pending: thêm migration.
- Ảnh nén lỗi 3 lần vẫn nằm trong chỉ mục hàng chờ nén: worker phải lọc `compress_attempts < 3`.

## Task

- [ ] **Task 1: Worker nén ảnh.** `scripts/compress-worker.ts`, nghiệp vụ ở `src/server/compress.ts`. Test S3 trên bucket dev: ảnh png lớn thành webp nhỏ hơn 300 KB, cạnh dài 1600; ảnh đã đạt không đổi; lỗi 3 lần thì dừng.
- [ ] **Task 2: Hàm so chữ.** Chép `text.ts` cần dùng. Test unit với chữ OCR mẫu: tên dính khoảng trắng, tên dư chữ, mã AT105 với AT1050, O với 0.
- [ ] **Task 3: Xếp lượt và worker kiểm ảnh.** Migration unique pending, `src/server/photoCheck.ts`, `src/server/ocr/reader.ts`, `scripts/ocr-server.py`, `scripts/photo-check-worker.ts`. Test DB: xếp lượt thay lượt cũ, kết quả ghi đúng `passed`/`total`, lượt bị thay thì bỏ. Test tích hợp với OCR thật (bỏ qua nếu thiếu `OCR_PYTHON`): ảnh sinh từ chữ (vẽ họ tên và mã lên ảnh bằng sharp hoặc canvas) đọc ra đạt.
- [ ] **Task 4: Giao diện.** Khối Xác thực ảnh ở Trang 4, dòng x/y và bộ lọc ở Trang 3. E2E: học sinh nộp ảnh có chữ họ tên và mã, chạy worker một vòng (`--mot-vong`), Trang 4 hiện Đạt.

Cuối giai đoạn chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.
