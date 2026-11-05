# Giai đoạn 4: Web học sinh

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** học sinh quét QR của trường, khai thông tin, chọn ngân hàng, làm theo hướng dẫn, nộp ảnh, gửi kiểm tra, xem kết quả. Tất cả trên điện thoại, tên miền `bank.*`.

**Kiến trúc:** trang ở `src/app/student/**` (proxy rewrite từ tên miền học sinh). API ở `src/app/api/customers/**`, `src/app/api/schools/**`. Nghiệp vụ ở `src/server/customers.ts` (và file nhỏ cùng nhóm nếu cần). Học sinh không có tài khoản: máy chủ cấp token 32 byte lúc khai B1, DB lưu băm sha256 (`customers.token_hash`), điện thoại giữ token trong localStorage và gửi qua header `Authorization: Bearer <token>`.

**Thiết kế gốc:** các mục `id="b0"`, `b1`, `b2`, `b3`, `b4`, `trang-thai` và màn H0 tới H6b trong `../Mở tài khoản học sinh qua QR trường.html`. Chép câu chữ trên màn từ đó. Luật ghi dữ liệu ở mục `id="du-lieu"` phần "Luật ghi dữ liệu".

## Quyết định đã chốt

- Link QR là `/t/<id trường>`. Web lưu id trường vào localStorage rồi đổi URL về `/`. Id của trường khác với id đang lưu thì web hỏi (màn H1). Id sai thì web bỏ và dùng id đang lưu. Máy chưa có trường thì màn H0. Trường đã đóng thì web báo trường đã đóng.
- Không màn giới thiệu: quét QR xong vào thẳng B1.
- B1 có 5 ô bắt buộc: Họ và tên, Lớp, SĐT học sinh, Họ và tên phụ huynh, SĐT phụ huynh. Ô Lớp có placeholder `11A3`, máy chủ viết hoa và bỏ khoảng trắng. SĐT 10 số bắt đầu bằng 0, hai SĐT khác nhau. Không thu ngày sinh, không xét tuổi. Học sinh tick các ngân hàng đã có tài khoản (`customer_existing_banks`). Không OTP. `customers.name_search` = họ tên bỏ dấu, chữ thường (dùng `plain` trong `src/lib/text.ts`). `created_ip` từ `x-forwarded-for`.
- B2: máy chủ tính danh sách ngân hàng đủ điều kiện, không tin dữ liệu từ điện thoại: ngân hàng đang bật, không nằm trong danh sách đã có, có ít nhất một mã đang dùng gắn cho trường còn lượt trong tháng. Còn từ 2 trở lên thì phải chọn đúng 2. Chọn trước là vị trí 1, chọn sau là vị trí 2. Còn 1 thì web chọn sẵn. Còn 0 thì màn H3c, `customers.status = no_bank`.
- Bấm Tiếp tục ở B2 mới giữ chỗ. Một transaction: khoá các dòng mã ứng viên (`select ... for update`), với mỗi ngân hàng chọn mã có `priority` cao nhất còn lượt trong tháng. Tháng chưa có dòng `referral_code_months` thì tạo dòng, chép `monthly_quota`. Ghi `customer_banks` (`selected`, `slot`, `referral_code_id`, bản chép `referral_code`, `year_month`), học sinh sang `banks_selected`. Hết lượt giữa chừng thì trả lỗi để web tải lại danh sách. Không có hạn giữ chỗ, hệ thống không tự trả lượt.
- B3: mỗi ngân hàng một tab: các bước hướng dẫn (`banks.guide`), mã giới thiệu dạng chữ và ảnh QR, nút Sao chép, nút "Quét QR code" mở `referral_codes.open_url` ở tab mới (ẩn khi không có link), các khung ảnh (`bank_photo_slots` chưa bỏ, theo `sort_order`) có tên và ảnh mẫu.
- Nộp ảnh: điện thoại nén ảnh còn dưới 300 KB (canvas, cạnh dài tối đa 1600, xuất webp hoặc jpeg), xin presigned PUT cho một khung, tải thẳng lên S3, rồi báo máy chủ ghi `proof_photos`. Máy chủ kiểm object có thật và dung lượng (HeadObject). Trước khi gửi kiểm tra, chụp lại khung đó thì máy chủ xoá dòng và object cũ, ghi dòng mới. Thư mục ảnh học sinh là `proofs` (thêm vào `src/lib/imageKey.ts`, nhận cả heic).
  Nếu S3 FPT không nhận CORS cho PUT từ trình duyệt thì chuyển sang tải qua máy chủ như ảnh của trang quản lý, ghi ruling.
- Nút Quay lại ở B3: hỏi xác nhận nếu đã có ảnh. Một transaction xoá các dòng `customer_banks` trạng thái `selected` và ảnh của chúng; đọc `s3_key` trước khi xoá rồi xoá object S3. Học sinh về `new`, lượt trả về mã ngay.
- Nút Gửi kiểm tra bật khi mọi khung của mọi ngân hàng đã chọn đều có ảnh. Máy chủ kiểm lại. Một transaction: `customer_banks` sang `pending`, `submitted_at`; học sinh sang `pending_review`, `submitted_at`; mỗi ngân hàng có khung bật `check_name` hoặc `check_code` thì thêm một dòng `photo_checks` trạng thái `pending` (worker làm ở giai đoạn 6). Sau bước này API ảnh từ chối mọi request của học sinh đó.
- B4 (màn H5, H6, H6b): danh sách ngân hàng kèm trạng thái Chờ kiểm tra, Đạt, Không đạt. Không hiện lý do không đạt. Có voucher thì hiện mã voucher, nút Sao chép, QR tới link app PVI lấy từ `settings.pvi_app_url`. Có QR kết bạn Zalo từ `settings.zalo_url`. Mở web lần nào cũng ghi `customers.last_seen_at`.
- Ảnh mẫu và ảnh QR của mã: route ảnh của học sinh chỉ cấp presigned URL cho khoá thuộc ngân hàng học sinh đã chọn (ảnh mẫu, ảnh QR của mã được cấp) và ảnh của chính học sinh.
- Giao diện cho điện thoại trước, theo màn H0 tới H6b. Dùng token màu và component có sẵn.
- Giới hạn request theo IP làm ở Nginx (giai đoạn 7), không làm trong app.

## Việc để lại từ giai đoạn trước thuộc giai đoạn này

- Check `year_month` nhận `2026-13`: dùng `isYearMonth` khi ghi.
- Chưa ràng buộc `proof_photos.slot_id`, `customer_banks.referral_code_id` cùng ngân hàng với dòng `customer_banks`: code máy chủ phải kiểm.
- Quay lại từ B3: đọc `s3_key` trước khi xoá dòng vì cascade xoá dòng ảnh.
- Matcher của proxy bỏ qua mọi đường dẫn có đuôi ảnh: sửa để chỉ bỏ qua file có thật trong `public/`, đường dẫn `/admin/...x.png` và `/student/...` không đi vòng qua kiểm tên miền.
- Route ảnh của trang quản lý `/api/admin/images` đang mở cho mọi người đăng nhập: khoá thư mục `proofs` lại, để giai đoạn 5 kiểm quyền theo ngân hàng.

## Task

Mỗi task: viết test trước, xem fail, code, xem pass, commit.

- [ ] **Task 1: Mở web và token.** `/t/[id]`, `/`, màn H0, H1, trường đã đóng. `GET /api/schools/:id`. Nghiệp vụ tạo token, đọc học sinh theo token, ghi `last_seen_at`. Test unit cho xử lý id trường trên máy (hàm thuần), test DB cho token.
- [ ] **Task 2: B1 khai thông tin.** Form, `POST /api/customers`, danh sách ngân hàng để tick "đã có". Test DB: dữ liệu sai bị từ chối, lớp viết hoa bỏ khoảng trắng, `name_search`, `customer_existing_banks`.
- [ ] **Task 3: B2 chọn ngân hàng và giữ chỗ.** Danh sách đủ điều kiện, `POST /api/customers/me/banks`. Test DB: chọn đúng 2 hoặc 1, ngân hàng đã có bị loại, mã hết lượt bị loại, chọn mã ưu tiên cao nhất, tạo dòng tháng, nhiều request giữ chỗ cùng lúc không vượt quota (chạy song song bằng `Promise.all` với pool riêng), giữ chỗ tháng 10 rồi đánh dấu tháng 11 vẫn tính tháng 10.
- [ ] **Task 4: B3 hướng dẫn và nộp ảnh.** Tab ngân hàng, mã, QR, Sao chép, Quét QR code, khung ảnh, nén ảnh trên trình duyệt, presigned PUT (`scripts/s3-cors.ts` cài CORS cho bucket theo `STUDENT_ORIGIN`), ghi ảnh, chụp lại, Quay lại. Test DB cho ghi ảnh (khung của ngân hàng khác bị từ chối, chụp lại thay ảnh cũ) và Quay lại (trả lượt, xoá object). Test S3 cho presigned PUT.
- [ ] **Task 5: Gửi kiểm tra và màn kết quả.** `POST /api/customers/me/submit`, màn H5, H6, H6b, voucher, QR PVI, QR Zalo. Test DB: thiếu ảnh bị từ chối, sau khi gửi không nộp ảnh được nữa, xếp `photo_checks`.
- [ ] **Task 6: Việc để lại và e2e.** Sửa matcher của proxy và khoá `proofs` ở route ảnh quản lý. E2E trên khổ điện thoại (`devices["iPhone 13"]` hoặc viewport 390x844): quét link trường, khai, chọn 2 ngân hàng, nộp ảnh mọi khung, gửi, thấy màn chờ. E2E dựng dữ liệu bằng tiền tố `ZZE2E ` và dọn trong `scripts/e2e-clean.ts`.

Cuối giai đoạn chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.
