# Vấn đề tồn đọng của mgi-bank

Ngày lập: 2026-11-13. Code ở commit `79e3626`, nhánh `dev`, chưa push.

File này gom mọi việc chưa xong sau phiên làm việc 2026-11-12 tới 2026-11-13. Mỗi dòng ghi hiện trạng và việc phải làm.

## 1. Nghiệp vụ

Chi tiết của 6 điểm đầu nằm ở `docs/2026-11-12-diem-can-xu-ly-truoc-training.md`.

| # | Vấn đề | Hiện trạng | Việc phải làm |
|---|---|---|---|
| 1 | SMS chưa gửi thật | `sendSms` chỉ ghi log rồi báo đã gửi | Chọn nhà cung cấp SMS, nối vào `src/server/sms/send.ts` |
| 2 | PVI chưa xác nhận mã voucher | Chưa biết app PVI có nhận mã tự sinh không; link app PVI là link tạm | Hỏi PVI, rồi Quản trị đổi link ở trang Cài đặt |
| 3 | Học sinh chọn 2 ngân hàng nhưng chỉ mở được 1 | Không gửi kiểm tra được; quay lại thì mất ảnh đã nộp | Chủ dự án đã nêu hướng sửa ngày 2026-11-12, xem mục 2 |
| 4 | Ca Không đạt không có bước tiếp cho học sinh | Web chỉ hiện Không đạt; link Zalo mặc định trống | Quản trị nhập link Zalo ở trang Cài đặt |
| 5 | Hai worker phải chạy | `sms:worker` và `photo-check:worker` không chạy sẵn ở máy local | Bật cả hai ở môi trường training và production |
| 6 | Hai ca cấu hình sai chưa quyết | Trường chưa gắn mã (B14), ngân hàng không có khung ảnh (D8) | Chủ dự án quyết luật cho hai ca |
| 7 | Quyền Quản lý sửa tài khoản Quản trị | File quyết định cho phép, code chặn ở `src/server/users.ts` | Chủ dự án chọn một trong hai |

## 2. Hướng sửa ca "mở được 1 trong 2 ngân hàng" (chưa làm)

Chủ dự án nêu ngày 2026-11-12, rồi tạm dừng để ưu tiên việc khác. Chưa có dòng code nào.

- Học sinh nộp đủ ảnh một ngân hàng thì gửi kiểm tra riêng ngân hàng đó.
- Ngân hàng đã gửi thì khoá: không xoá, không đổi ảnh.
- Quay lại bước 2 thì không chọn lại được ngân hàng đã gửi.
- Bước 1 tick sẵn và khoá ngân hàng đã gửi ở khối "Ngân hàng đã có tài khoản".

Ba điểm chủ dự án chưa chốt:

1. Học sinh muốn dừng ở 1 ngân hàng: có nút "Không mở thêm" ở bước 2 không.
2. Có khoá họ tên, lớp, SĐT từ lúc gửi ngân hàng đầu tiên không.
3. Tổng số ngân hàng vẫn tối đa 2 hay không.

## 3. Kiểm thử sau lượt chép giao diện mgst-app

| Việc | Hiện trạng |
|---|---|
| E2E | Project chromium chạy lại ngày 2026-11-17 trên Windows sau khi sửa spec theo luồng gửi từng ngân hàng. Lỗi có sẵn từ lượt chép giao diện tìm ra và đã sửa: tên trường mất khỏi đầu trang học sinh (5e0d029), tiêu đề hộp thoại không xuống dòng vì thừa hưởng nowrap của ô bảng, ô tìm ở điện thoại không chiếm trọn hàng. Còn fail trên Windows: ops.spec (cần ops-watch chạy trên Linux). Project flows (video) chưa chạy lại |
| Test e2e đã sửa mà chưa chạy thử | Mở nhóm sidebar trước khi tìm link (10 file), phân trang ẩn khi 1 trang (3 file), nút Bộ lọc không còn huy hiệu số, ô ngày |
| Test dễ fail nhất | Các ca đo hình học bảng Bộ lọc ở `e2e/mobile.spec.ts`: bảng ở màn hẹp cao khoảng 586 px, trước là 544 px |
| Nhìn bằng mắt | Đã xem ảnh chụp trang Trường, Hồ sơ học sinh, chi tiết hồ sơ, hộp Sửa trường. Các trang còn lại và giao diện Tối chưa ai xem |
| Bộ lọc mới của trang Mã voucher | Chạy đúng trên DB local, chưa có test tự động |
| Danh sách thả của ô chọn nhiều giá trị | Đã đổi sang đặt theo vị trí ô nhập, chưa chụp kiểm |

Chạy e2e sẽ dừng dev server ở cổng 3100 và thay bằng bản build. Chạy xong phải bật lại `bun dev`.

## 4. Điểm khác mgst-app hoặc khác chuẩn, có chủ ý

| Điểm | Lý do |
|---|---|
| Viền ô nhập ở trang quản lý có tương phản 1,25:1, dưới mức 3:1 của WCAG | Chủ dự án yêu cầu giống mgst-app ngày 2026-11-12. Quay lại viền đậm: bỏ class `[--field-border:var(--line)]` ở `AppShell.tsx` và `login/page.tsx` |
| 4 màu chủ đạo mới (Xanh dương, Xanh ngọc, Hồng, Xám than) chưa đo tương phản | `tests/unit/contrast.test.ts` chỉ đo bộ cam |
| Lịch chọn ngày không khoá trong một tháng | Luật đó của mgst-app phục vụ KPI theo tháng |
| Danh sách giá trị lọc không có ô tìm | Chủ dự án từ chối ngày 2026-11-12 |
| Không có chuông thông báo, ô "Ghi nhớ đăng nhập", toast | Là tính năng mới, chưa ai yêu cầu |
| Tên hiển thị ở Kho mã vẫn in đậm | Test e2e đang tìm theo kiểu chữ đó |

## 5. Dữ liệu và môi trường

- DB local `mgibank`: 1 mã voucher `THPTND-NT-11A2-UHMD` đã bị cắt chữ "ZZDEMO" bằng tay. Bốn ký tự kiểm của mã này không còn khớp, mã chỉ dùng để trình bày.
- DB `mgibank_video` trong container `mgi-bank-db`: dữ liệu mẫu để chụp ảnh slide, gồm trường "THPT Lê Quý Đôn", 8 học sinh, 7 tài khoản. Mật khẩu ở `scripts/video-data.ts`. Xoá được bất kỳ lúc nào.
- Bucket S3 `mgi-bank-dev` có thêm ảnh mẫu và ảnh nộp của dữ liệu trên.
- Chưa push `dev` lên GitHub. Chưa deploy.

## 6. Việc dở có từ trước phiên này

- Kế hoạch 25 video hướng dẫn ở `docs/plans/2026-11-10-video-huong-dan-design.md`: mới có seed và 1 spec. Các file chưa commit: `scripts/video-run.sh`, `scripts/video-seed.ts`, `scripts/video-data.ts`, `scripts/data/bank-guides.json`, `e2e/flows/quan-ly/`, phần sửa ở `scripts/e2e-videos.ts`.
- 11 video cũ ở `e2e/videos` quay trước lượt sửa giao diện, không còn khớp màn hình hiện tại.

## 7. Slide giới thiệu

- Slide 18 trang ở https://claude.ai/artifact/EGhjVANAdSUnqLqDPHW5uc, đang ở chế độ riêng tư.
- Chưa ai xem lại bố cục từng trang trên trình duyệt.
- Ảnh trong slide chụp ngày 2026-11-13. Giao diện đổi thì phải chụp lại.
