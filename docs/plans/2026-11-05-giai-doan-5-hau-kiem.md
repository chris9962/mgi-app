# Giai đoạn 5: Hậu kiểm, voucher, SMS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** người quản ngân hàng xem hồ sơ, xem ảnh, đánh dấu Đạt hoặc Không đạt. Đạt đầu tiên của học sinh sinh mã voucher và xếp SMS. Có trang Mã voucher, trang Tin SMS lỗi, Xuất Excel.

**Thiết kế gốc:** Trang 3, 4, 12, 16 và mục `id="hau-kiem"`, `id="du-lieu"` (luật "Hậu kiểm bấm Đạt hoặc Không đạt", "Đổi kết quả", "Sinh mã voucher", "Worker SMS", "Xem ảnh", "Sửa thông tin và thay ảnh") trong `../Mở tài khoản học sinh qua QR trường.html`.

## Quyết định đã chốt

- Phạm vi: Quản trị, Quản lý thấy hồ sơ toàn công ty. Nhân viên thấy hồ sơ có chọn ngân hàng mình quản (`customerScope`). Ngoài phạm vi trả 404.
- Trang 3 Hồ sơ học sinh: cột Gửi lúc, Họ tên, Lớp, Trường, SĐT phụ huynh, Ngân hàng 1, Ngân hàng 2, Người kiểm. Ô ngân hàng có nhãn trạng thái; ngân hàng người xem quản thì thêm dòng "Xác thực ảnh x/y" (lượt `photo_checks` mới nhất, có ở giai đoạn 6). Phân trang, tìm, lọc ở máy chủ. Tìm theo họ tên không phân biệt dấu (`name_search` + trigram) hoặc SĐT. Bộ lọc: trạng thái, ngày gửi, số ngân hàng đạt (1 hoặc 2), kết quả xác thực ảnh. Vẽ bảng Bộ lọc theo mẫu mgst-app.
- Trang 4 Chi tiết hồ sơ, xếp trên dưới: khối Thông tin (Họ tên, Lớp, Trường, SĐT, Phụ huynh, SĐT phụ huynh có link gọi, Đã có TK, Hồ sơ trùng cùng tên và SĐT, Gửi lúc, Mở web lần cuối) có nút Sửa thông tin. Mỗi ngân hàng một khối. Ngân hàng người xem quản: ảnh từng khung (presigned 10 phút, mỗi lần xem ghi `audit_log` `view_photo`), khối Xác thực ảnh, Ghi chú nội bộ, nút Đạt, Không đạt, Tải ảnh thay thế. Ngân hàng khác của hồ sơ: chỉ dòng tiêu đề và trạng thái, không hiện ảnh. Khối SMS cho phụ huynh.
- Đánh dấu: một transaction khoá dòng `customers`, cập nhật `customer_banks` với điều kiện trạng thái đúng (không có dòng nào đổi thì báo "đã có người đánh dấu"), ghi `review_events`. Đạt đầu tiên (`first_passed_at` rỗng): ghi thời điểm, sinh voucher, thêm `sms_messages` `queued`. Hết ngân hàng `pending` thì học sinh sang `reviewed`.
- Dòng Đạt bị khoá: không đổi kết quả, không thay ảnh. Hồ sơ đã có voucher thì không sửa thông tin. Dòng Không đạt đổi được sang Đạt; nếu học sinh chưa có voucher thì lượt đổi này sinh voucher và gửi SMS như lượt đầu, đã có thì không gửi thêm. Không theo dõi "đã gọi".
- Thay ảnh: ghi `replaced_at` cho ảnh cũ, thêm dòng mới có `uploaded_by`. Thay ảnh hoặc sửa họ tên thì xếp lại lượt `photo_checks` cho ngân hàng liên quan (xoá dòng pending cũ, thêm dòng mới, `pg_notify`).
- Mã voucher: `viết tắt trường-viết tắt học sinh-lớp-4 ký tự kiểm`, ví dụ `THPTND-TMA-11A3-K7Q2`. Viết tắt: bỏ dấu, viết hoa, chữ cái đầu mỗi từ; từ viết hoa toàn bộ như THPT, THCS giữ nguyên. Lớp viết hoa bỏ khoảng trắng. Ký tự kiểm: HMAC-SHA256 (khoá `VOUCHER_SECRET` trong env) của id học sinh, mã tỉnh, mã xã của trường, họ tên phụ huynh và 3 phần chữ; lấy 4 ký tự từ bảng chữ số không có 0, O, 1, I, L. Mã đã cấp không đổi khi sửa tên.
- SMS: nội dung theo `settings.sms_template`, thay `{HO_TEN}` (viết hoa bỏ dấu), `{LOP}`, `{TRUONG}` (bỏ dấu), `{NGAN_HANG}` (ngân hàng đạt đầu tiên), `{MA_VOUCHER}`. Gửi tới SĐT phụ huynh. Một học sinh một tin (`unique (customer_id, kind)`). Quá 160 ký tự thì gửi 2 tin.
- Module gửi SMS `src/server/sms/send.ts` có một hàm gửi dùng chung. Bản đầu chưa nối nhà cung cấp: hàm ghi số nhận và nội dung ra log. Worker `scripts/sms-worker.ts` lấy tin `queued` bằng `for update skip locked`, nghe `LISTEN` và quét lại mỗi 30 giây. Gửi lỗi thì thử lại, tối đa 3 lần, rồi đánh dấu `failed`.
- Trang 16 Tin SMS lỗi: tin `failed` trong phạm vi người xem, sửa SĐT, nút Gửi lại (đặt lại `attempts = 0`, trạng thái `queued`). Mục "Tin SMS lỗi" trên sidebar hiện số tin lỗi trong phạm vi người xem.
- Trang 12 Mã voucher (quyền `vouchers`): Mã voucher, Họ tên, Lớp, Trường, Phụ huynh, Ngày cấp. Tìm theo mã, họ tên.
- Xuất Excel (quyền `export_excel`): chép `src/lib/excel.ts` của mgst-app (đầu bảng 3 tầng, chuẩn mục 12 trong `../mgst-app/AGENTS.md`). File xuất đúng bộ lọc đang xem và đúng phạm vi người xuất. Có ở Trang 3 (hồ sơ), Trang 5 (trường), Trang 12 (voucher). Mỗi lần xuất ghi `audit_log`.
- Route ảnh quản lý: ảnh thư mục `proofs` chỉ người quản ngân hàng của dòng ảnh đó, Quản trị, Quản lý xem được.

## Việc để lại từ giai đoạn trước thuộc giai đoạn này

- `sms_messages.kind` text tự do; nút Gửi lại phải đặt lại `attempts`.
- Tìm kiếm phân biệt dấu ở Trường, Kho mã, ô chọn người quản; chưa thoát `%` `_`. Sửa luôn cho các ô tìm cũ.
- Mẫu SMS nhận biến không có thật như `{HOTEN}`: Cài đặt phải từ chối biến lạ.
- Chưa có test DB cho khoá đăng nhập khi nhiều request cùng lúc, chưa có test API Nhân viên nhận 403.

## Task

- [ ] **Task 1: Danh sách hồ sơ.** Nghiệp vụ, route, Trang 3, Bộ lọc. Test DB: phạm vi, lọc, tìm không dấu, phân trang.
- [ ] **Task 2: Chi tiết hồ sơ, xem ảnh, sửa thông tin.** Trang 4. Test DB: Nhân viên không xem được ảnh ngân hàng khác, mỗi lần xem ảnh ghi audit, hồ sơ có voucher không sửa được.
- [ ] **Task 3: Đánh dấu, đổi kết quả, thay ảnh.** Test DB: hai người cùng đánh dấu một dòng thì người sau nhận lỗi và chỉ một voucher, một SMS (chạy song song); Đạt khoá; Không đạt sang Đạt sinh voucher khi chưa có; thay ảnh xếp lại `photo_checks`.
- [ ] **Task 4: Mã voucher.** Hàm sinh mã thuần, test unit với ví dụ thiết kế (viết tắt, lớp, bảng chữ ký tự kiểm, cùng dữ liệu cùng mã). Trang 12.
- [ ] **Task 5: SMS.** Module gửi, worker, Trang 16, số đếm trên sidebar. Test DB: worker gửi tin `queued`, lỗi 3 lần thì `failed`, Gửi lại đặt lại `attempts`.
- [ ] **Task 6: Xuất Excel và việc để lại.** Chép `excel.ts`, ba route export, tìm không dấu cho các ô tìm cũ, chặn biến lạ trong mẫu SMS, hai test còn thiếu.
- [ ] **Task 7: E2E.** Học sinh nộp ảnh (dựng bằng API hoặc chạy lại luồng giai đoạn 4), người quản đánh dấu Đạt, thấy voucher trên Trang 4 và Trang 12, học sinh thấy voucher ở màn kết quả; Nhân viên không thấy ảnh ngân hàng khác.

Cuối giai đoạn chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.
