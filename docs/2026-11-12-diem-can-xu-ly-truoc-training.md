# Điểm cần xử lý trước buổi training

Ngày lập: 2026-11-12. Code ở commit `5e0d029`, nhánh `dev`.

Claude đọc code và so với các quyết định ở `../du-an-mo-tai-khoan-hoc-sinh/cau-hoi-kien-truc-2026-11-03.md`.
Flow nghiệp vụ trong code khớp các quyết định đó. Lượt chạy `e2e` project `flows` ngày 2026-11-12 đạt 11/11.

Sáu điểm dưới đây không phải lỗi code. Mỗi điểm làm người học hiểu sai hoặc hỏi lại nếu buổi training không nói rõ.

## 1. SMS chưa gửi thật

- Hàm `sendSms` ở `src/server/sms/send.ts` chỉ ghi số nhận và nội dung ra log, rồi trả kết quả đã gửi.
- Trang quản lý hiện tin ở trạng thái Đã gửi. Phụ huynh không nhận tin nào.
- Nguồn: quyết định D1 ngày 2026-11-05, chưa chọn nhà cung cấp SMS.
- Việc phải làm: chọn nhà cung cấp rồi nối vào hàm `sendSms`, hoặc nói rõ ở buổi training rằng tin chưa tới phụ huynh.

## 2. PVI chưa xác nhận nhận mã voucher tự sinh

- Hệ thống tự sinh mã voucher dạng `THPTND-TMA-11A3-K7Q2`.
- Chưa có câu trả lời của PVI cho ba câu hỏi: app PVI có nhận mã này không, mã dài tối đa bao nhiêu ký tự, mã có được chứa dấu `-` không.
- Bước cuối của flow là phụ huynh nhập mã trên app PVI. Bước này chưa kiểm được.
- Link app PVI mặc định là link tạm `https://www.pvi.com.vn`, khai ở `DEFAULT_PVI_APP_URL` của `src/lib/sms.ts`.
- Việc phải làm: hỏi PVI ba câu trên. Quản trị đổi link app PVI ở trang Cài đặt khi có link chính thức.

## 3. Học sinh chọn 2 ngân hàng nhưng chỉ mở được 1

- Nút Gửi kiểm tra đòi đủ ảnh của mọi ngân hàng đã chọn. Học sinh thiếu ảnh của một ngân hàng thì không gửi được.
- Học sinh bấm Quay lại chọn ngân hàng thì web vẫn bắt chọn đủ 2 ngân hàng khi trường còn từ 2 ngân hàng trở lên.
- Nguồn: quyết định C7 ngày 2026-11-05, giữ luật đòi đủ ảnh. Cơ chế xoá hồ sơ bỏ dở chưa làm.
- Việc phải làm: chốt câu trả lời cho nhân viên khi học sinh hỏi ca này.

## 4. Ca Không đạt không có bước tiếp theo cho học sinh

- Màn kết quả của học sinh chỉ hiện chữ Không đạt. Màn này không ghi lý do và không nhận ảnh nộp lại.
- Nhân viên xử lý ở trang quản lý: tải ảnh thay thế, rồi đổi kết quả từ Không đạt sang Đạt.
- Kênh liên hệ duy nhất của học sinh là QR Zalo trên web. Link Zalo mặc định đang trống, nên web không hiện QR Zalo.
- Việc phải làm: Quản trị nhập link Zalo ở trang Cài đặt trước buổi training. Buổi training hướng dẫn nhân viên các bước xử lý ca Không đạt.

## 5. Hai worker phải chạy ở môi trường training

- `bun sms:worker` gửi tin SMS trong hàng chờ. Không có worker này thì tin đứng ở trạng thái chờ gửi.
- `bun photo-check:worker` đọc chữ trên ảnh. Không có worker này thì khối Xác thực ảnh không có kết quả.
- Ngày 2026-11-12, máy local không chạy worker nào trong hai worker này.
- Việc phải làm: bật cả hai worker ở môi trường dùng cho buổi training, rồi kiểm một hồ sơ mẫu trước buổi.

## 6. Hai ca cấu hình sai chưa có quyết định

| Ca | Màn hình hiện gì | Mã ca |
|---|---|---|
| Trường chưa gắn mã giới thiệu nào | Học sinh khai thông tin xong thì thấy "Ngân hàng đã hết lượt trong tháng này" | B14 |
| Ngân hàng không có khung ảnh nào | Web coi ngân hàng đó đủ ảnh, học sinh gửi kiểm tra được mà không có ảnh | D8 |

- Hai ca này chờ chủ dự án quyết từ 2026-11-07.
- Việc phải làm: trước buổi training, kiểm mọi trường đã gắn mã giới thiệu và mọi ngân hàng đang mở đã có khung ảnh.
