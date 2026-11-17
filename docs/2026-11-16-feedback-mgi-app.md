# Feedback mgi app ngày 2026-11-16

Chủ dự án gửi toàn bộ feedback ngày 2026-11-16. Code hiện tại ở nhánh `dev`.

Web học sinh hiện có 3 bước: 1 Thông tin, 2 Chọn ngân hàng, 3 Mở tài khoản. Sau bước 3 là màn Kết quả.

## 1. Bước 1 Thông tin

- [x] Bỏ ô "SĐT" của học sinh. Màn này chỉ giữ "SĐT phụ huynh". Làm 2026-11-17, migration 0013 xoá cột `customers.phone`.
  - Trang quản lý, tìm kiếm và file Excel đang dùng SĐT học sinh. Phải sửa cả các chỗ đó.

## 2. Bước 2 Chọn ngân hàng

- [x] Bỏ giới hạn số ngân hàng học sinh mở. Chốt 2026-11-17: chọn từ 1 tới hết ngân hàng còn lượt của trường, lượt theo tháng của mã giới thiệu giữ nguyên. Migration 0016 bỏ trần slot.
  - Code hiện tại bắt chọn đúng 2 ở `ChooseBanks.tsx` và `src/server/customers.ts`.
- [x] Học sinh chọn một ngân hàng thì hiện thông tin tổng quan của ngân hàng đó. Làm 2026-11-17: nút Thông tin trên mỗi thẻ mở hộp toàn màn hình, tab Thông tin.
- [x] Đưa hướng dẫn mở tài khoản vào bước 2. Làm 2026-11-17: tab Hướng dẫn mở tài khoản trong hộp đó, lấy từ hướng dẫn đã cài ở cấu hình ngân hàng.
- [x] Hiện tên đầy đủ tiếng Việt của ngân hàng. Làm 2026-11-17: seed `banks.json` đổi sang tên đầy đủ; DB đang chạy thì Quản trị sửa tên ở cấu hình ngân hàng.
- [x] Thêm số tổng đài vào thông tin ngân hàng. Làm 2026-11-17: migration 0014 thêm `banks.hotline`, `banks.overview`.
  - Trang quản lý phải có ô nhập số tổng đài ở cấu hình ngân hàng.

## 3. Bước 3 Mở tài khoản

- [x] Học sinh nộp đủ ảnh của một ngân hàng thì hiện hộp thoại hỏi đã hoàn thành chưa. Làm 2026-11-17: hộp "Đã hoàn thành ...?" hiện ngay sau ảnh cuối, xác nhận thì gửi kiểm tra riêng ngân hàng đó (API POST /api/customers/me/banks/:id/submit). Trạng thái hồ sơ suy từ các dòng ngân hàng (`src/server/customerStatus.ts`).
  - Học sinh xác nhận thì app gửi kiểm tra ngân hàng đó ngay. App không chờ nộp đủ ảnh của mọi ngân hàng.
  - Ba điểm chưa chốt ở mục 2 của `docs/2026-11-13-van-de-ton-dong.md` xử lý 2026-11-17: (1) có nút "Không mở thêm ngân hàng" ở bước 3 sau khi đã gửi ít nhất một ngân hàng; (2) họ tên, lớp, SĐT phụ huynh khoá từ lần gửi đầu; (3) không còn trần 2 ngân hàng. Thêm: màn Kết quả có nút "Mở thêm ngân hàng" khi trường còn ngân hàng chưa mở.
- [x] Từ ngân hàng thứ 2, hiện thông báo học sinh nhận được 20.000 đồng. Làm 2026-11-17 theo giả định (câu hỏi 4 chưa có trả lời): gửi kiểm tra xong ngân hàng thứ 2 thì hộp "Nhận 20.000 đồng" hiện ngay; màn Kết quả có thẻ Quà với nút Nhận quà.
  - Sau thông báo, học sinh nhập thông tin nhận quà. Giả định 2026-11-17: nhập ngân hàng nhận (một trong các ngân hàng đã gửi), số tài khoản, tên chủ tài khoản; bảng `gift_claims`, migration 0017. Trang quản lý: chi tiết hồ sơ có thẻ Quà 20.000 đồng, người có quyền Quản lý voucher bấm "Đã chuyển quà"; Excel hồ sơ thêm hai cột TK NHẬN QUÀ, CHUYỂN QUÀ. Chưa có màn theo dõi riêng, chưa ràng buộc phải Đạt mới được nhận.
- [ ] Viết hướng dẫn chi tiết hơn ở mỗi bước.
- [ ] Làm clip hướng dẫn chi tiết. Clip gồm các phần:
  - Ảnh nhập mã giới thiệu.
  - Ảnh thông tin tài khoản, có họ tên và STK.
  - Giao dịch chuyển khoản. Feedback ghi "khó xác định".

## 4. Màn Kết quả

- [x] Thêm câu "Mời bạn chọn bảo hiểm" và 3 lựa chọn. Mỗi lựa chọn mở link tới MyPVI. Làm 2026-11-17: link từng sản phẩm nhập ở trang Cài đặt, chưa có link thì ẩn.
  - BH tai nạn học sinh.
  - BH xe máy.
  - BH tai nạn hộ sử dụng điện.
  - Việc này khác quyết định 2026-11-06: màn Kết quả chỉ có QR và nút "Mở app PVI".
- [x] Thêm hướng dẫn mua sản phẩm. Làm 2026-11-17: ô Hướng dẫn mua của từng sản phẩm ở trang Cài đặt, web học sinh hiện dạng gấp mở.
- [x] Thêm hướng dẫn chi tiết cho từng loại bảo hiểm. Nội dung do chủ dự án nhập ở Cài đặt.
  - BH xe máy: học sinh làm gì, nhập gì.
  - BH học sinh: học sinh nhập gì, làm gì.
- [x] Thêm lời cảm ơn ở bước cuối: "Cảm ơn các bạn tham gia chương trình khuyến học của tỉnh." Làm 2026-11-17: câu mặc định, sửa được ở Cài đặt.

## 5. Câu cần hỏi lại chủ dự án

| # | Feedback gốc | Câu hỏi |
|---|---|---|
| 1 | "Giao dịch ck -> khó xác định" | Bỏ ảnh giao dịch chuyển khoản, hay chỉ ghi nhận phần này khó quay clip? |
| 2 | "bước 2, bước 4: chọn ngân hàng" | Web có 3 bước và màn Kết quả. Bước 4 là màn nào? |
| 3 | "không giới hạn số lượng tạo bank" | Học sinh chọn tới khi hết ngân hàng của trường? Mã giới thiệu vẫn giữ quota theo tháng? |
| 4 | "từ ngân hàng thứ 2 sẽ có thông báo nhận được 20k" | Học sinh nhập những thông tin gì để nhận quà? Trang quản lý có cần màn theo dõi trả quà không? |
| 5 | "thêm hướng dẫn mua sản phẩm" | Sản phẩm là 3 loại bảo hiểm ở màn Kết quả, hay sản phẩm khác? |
| 6 | "thêm lời cảm ơn ở bước cuối" | Bước cuối là màn Kết quả? |
