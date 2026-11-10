# Rà tính năng, ca và độ phủ e2e: web học sinh

Ngày rà: 2026-11-10. Phạm vi: tên miền học sinh `bank.localhost:3100`, trang `src/app/student/**`, component `src/components/student/**`,
API `src/app/api/customers/**`, `src/app/api/schools/[id]`, nghiệp vụ `src/server/customers.ts`, `src/server/customerPhotos.ts`, `src/server/voucher.ts`.
Agent chỉ đọc repo, không chạy test. Nhánh lấy từ code: các nhánh `fail(...)` ở `src/server`, luật zod ở `src/lib/customerForm.ts`,
điều kiện render ở component, mã HTTP 400/401/403/404/409/413 ở route.

## Tóm tắt số

| Mục | Số |
|---|---|
| Tính năng | 21 |
| Ca | 196 |
| Ca chưa có e2e | 52 |
| Ca đề xuất có video | 52 |
| Ca đề xuất video mà video hiện có đã phủ | 22 |
| Ca đề xuất video mà video hiện có chưa phủ | 30 |

Bảng số đếm dòng ca ở mục 2. Cột E2E ghi "chưa có" thì đếm là chưa có e2e, kể cả khi có test DB hay chỉ gọi API.
Ca ghi "Không cần" (3 ca: không xảy ra, hay đã biết và không sửa) vẫn đếm là ca. Ca chỉ phủ ở flow 5 (T15.5, T15.8) đếm là có e2e.

## Ký hiệu cột E2E và Video

| Ký hiệu | File | Ghi chú |
|---|---|---|
| st-1 | `e2e/student.spec.ts` | test "Học sinh quét link trường, khai thông tin, chọn 2 ngân hàng, nộp ảnh mọi khung, gửi kiểm tra" |
| st-2 | `e2e/student.spec.ts` | test "đang tải ảnh thì không gửi kiểm tra được; tải ảnh lỗi thì khung báo lỗi và thử lại được" |
| st-3 | `e2e/student.spec.ts` | test "ảnh 15 MB gửi qua API tới đủ route: proxy không cắt body ở 10 MB, máy chủ đổi sang WebP" |
| es Ax, Bx | `e2e/edge-student.spec.ts` | tên test bắt đầu bằng mã ca, ví dụ "A1 máy mới mở link trường không có..." |
| esb Cx, Dx | `e2e/edge-student-banks.spec.ts` | như trên |
| esp Ex | `e2e/edge-student-photos.spec.ts` | E1 tới E8 |
| esa Gx, Ex | `e2e/edge-student-api.spec.ts` | G1 tới G9, E9 tới E12 |
| esq Ax | `e2e/edge-student-qr.spec.ts` | A15, A18, camera giả |
| esql A16 | `e2e/edge-student-qr-la.spec.ts` | A16, camera giả |
| esr Fx | `e2e/edge-student-result.spec.ts` | test "F1, F2, F4, F5 ...", "F3, F6, F7 ...", "F8 ..." |
| rv | `e2e/review.spec.ts` | test "Người quản ngân hàng đánh dấu Đạt, voucher hiện ở Trang 4, Trang 12 và màn kết quả của học sinh; ảnh ngân hàng khác không hiện" |
| V4 "bước" | `e2e/flows/04-hoc-sinh.spec.ts` | video `e2e/videos/04-hoc-sinh.webm`, tên bước là tên `test.step` |
| V5 "bước" | `e2e/flows/05-hau-kiem.spec.ts` | video `e2e/videos/05-hau-kiem.webm`, chỉ bước "Học sinh mở lại web: chỉ thấy QR và nút Mở app PVI, không có chữ voucher" là màn học sinh |

- `e2e/mobile.spec.ts` không có phần học sinh: mọi test đo trang quản lý.
- `e2e/photoCheck.spec.ts`, `e2e/customerBanks.spec.ts`, `e2e/review.spec.ts` đi qua B1 tới B3 bằng giao diện để dựng dữ liệu. Ba file này không kiểm thêm nhánh nào của web học sinh, trừ `rv` ở ca T15.3 và T16.
- Flow 6, 7, 9, 10 dựng học sinh qua API, không quay màn học sinh.
- Cột Đề xuất: "Video HS-n" là video ở mục 4. "E2E" là ca chỉ cần e2e. **Thiếu e2e**, **thiếu video** đánh dấu chỗ chưa có.

## 1. Danh sách tính năng

Mọi tính năng: người dùng là học sinh trên điện thoại, không đăng nhập. Máy giữ `mgi.schoolId`, `mgi.customerId`, `mgi.token` trong localStorage.

| Mã | Tính năng | Màn hay route | Điều kiện hiện ra |
|---|---|---|---|
| T1 | Mở web và giữ trường trên máy | `/`, `/t/<id>`; `GET /api/schools/<id>` | Luôn chạy lúc mở web (`resolveScreen` ở `StudentApp.tsx`) |
| T2 | Màn Chưa có trường và nút Quét mã QR | `/`, hộp thoại "Quét mã QR" | Máy chưa lưu trường hợp lệ và link không có id dùng được |
| T3 | Màn Đổi trường | `/t/<id>` | Id link hợp lệ, có trường, khác trường đang lưu, máy có token |
| T4 | Màn Trường đã đóng | `/`, `/t/<id>` | `schools.active` false và hồ sơ chưa có hay ở `new`, `no_bank` |
| T5 | Màn Không tải được và nút Thử lại | `/` | Đọc trường hay hồ sơ lỗi mạng hoặc máy chủ trả lỗi khác 401, 404 |
| T6 | B1 Khai thông tin | Tiêu đề "Thông tin", bước 1; `POST /api/customers` | Máy có trường đang mở, chưa có token dùng được |
| T7 | B1 Ngân hàng đã có tài khoản | Khối tick trong B1 | Trường có ngân hàng của chương trình (kể cả hết lượt) |
| T8 | B2 Chọn ngân hàng | "Chọn 2 ngân hàng", "Chọn ngân hàng", màn hết lượt, màn không có ngân hàng; `POST /api/customers/me/banks` | Hồ sơ `new` hoặc `no_bank`, trường mở |
| T9 | B3 Hướng dẫn, mã giới thiệu, nút Quét QR code | Tab ngân hàng ở "Mở tài khoản" | Hồ sơ `banks_selected` |
| T10 | B3 Ảnh mẫu | Nút ảnh mẫu, hộp xem ảnh lớn | Khung có `sample_key` |
| T11 | B3 Nộp ảnh từng khung | Ô chọn ảnh mỗi khung; `POST /api/customers/me/photos` | Hồ sơ `banks_selected`, ngân hàng có khung chưa bỏ |
| T12 | B3 Thanh tab ngân hàng | `role="tablist"` "Ngân hàng đã chọn" | Hồ sơ `banks_selected` |
| T13 | B3 Quay lại chọn ngân hàng | Nút ở đáy B3, hộp hỏi; `DELETE /api/customers/me/banks` | Hồ sơ `banks_selected`, trường mở |
| T14 | B3 Gửi kiểm tra | Nút ở đáy B3; `POST /api/customers/me/submit` | Hồ sơ `banks_selected` |
| T15 | Màn chờ và kết quả | Tiêu đề "<Họ tên> - <Lớp>" | Hồ sơ `pending_review` hoặc `reviewed` |
| T16 | Khối App PVI (voucher) | Vùng "App PVI" ở màn kết quả | Có dòng `vouchers` (cấp ở lần Đạt đầu) và Cài đặt có link app PVI |
| T17 | Khối Zalo | Link có QR "QR kết bạn Zalo" | Cài đặt có link Zalo; ở màn hết lượt, màn không có ngân hàng, màn kết quả |
| T18 | Mở lại web, token, đổi máy | `/`; `GET /api/customers/me` | Máy có token; trang hiện lại khi đang ở màn hồ sơ |
| T19 | Logo ngân hàng | Ô tick B1, nút chọn B2 | Mọi ngân hàng hiện ở B1, B2 |
| T20 | Khung trang: khổ màn, chữ dài, sáng tối | `src/app/student/layout.tsx`, `src/app/layout.tsx` | Mọi màn |
| T21 | API học sinh gọi thẳng | `/api/customers/**`, `/api/schools/<id>` | Gọi không qua web |

Không có trên web học sinh theo thiết kế (`b4` của file thiết kế): nút nộp lại ảnh hay gửi lại sau Không đạt, lý do Không đạt, mã voucher, dòng SMS, câu "nhân viên gọi cho phụ huynh".
Ảnh của ngân hàng Không đạt do nhân viên thay ở hậu kiểm, thuộc nhóm nghiệp vụ.

## 2. Ca của từng tính năng

### T1. Mở web và giữ trường trên máy

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T1.1 | Máy mới mở `/t/<id trường đang mở>` | Lưu id, URL về `/`, hiện B1 có tên trường | st-1; es A17 | V4 "Mở link QR của trường" | Video HS-1 |
| T1.2 | Máy mới mở `/t/<uuid không có>` | Chưa có trường, URL về `/` | es A1 | chưa có | E2E |
| T1.3 | Máy có trường mở `/t/abc` | Giữ trường đang lưu, không báo | es A2 | chưa có | E2E |
| T1.4 | Máy giữ id trường sai dạng | Chưa có trường | es A7 | chưa có | E2E |
| T1.5 | Máy giữ id trường đúng dạng mà trường đã bị xoá (404) | Xoá `mgi.schoolId`, Chưa có trường | chưa có | chưa có | E2E, **thiếu e2e** |
| T1.6 | Máy có trường A, chưa có hồ sơ, mở link trường B | Đổi sang B luôn, không hỏi (`decideLink` trả `switch`) | chưa có | chưa có | E2E, **thiếu e2e** |
| T1.7 | Máy có hồ sơ, quét lại QR của chính trường mình | Vào thẳng bước đang dở (`keep`) | chưa có | chưa có | Video HS-4, **thiếu e2e**, **thiếu video** |
| T1.8 | Link `/t/<id viết hoa>` khi có hồ sơ ở đúng trường | Code hỏi Đổi trường giữa hai tên giống nhau. Đã ghi ở kế hoạch ca biên, chờ chủ dự án | chưa có | chưa có | E2E khi chủ dự án chốt |
| T1.9 | `/t/<id>/thua`, `/abc`, `/admin`, `/student`, `/t/` | 404, không 500 | es A10 | chưa có | E2E |
| T1.10 | Ở B2 bấm Quay lại của trình duyệt rồi Tới | Hiện lại B2 | es A11 | chưa có | E2E |

### T2. Màn Chưa có trường và nút Quét mã QR

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T2.1 | Máy mới mở `/` | "Chưa có trường", "Quét mã QR dán ở trường.", nút Quét mã QR | st-1; es A14 | V4 "Mở web khi chưa quét QR" | Video HS-5 |
| T2.2 | Camera thấy QR link trường mang tên miền thật | Hộp thoại đóng, vào B1 của trường, URL `/`, lưu id | esq A15 | chưa có | Video HS-5, **thiếu video** |
| T2.3 | Camera thấy QR không phải link trường | "Mã QR này không phải của trường.", camera vẫn chạy | esql A16 | chưa có | Video HS-5, **thiếu video** |
| T2.4 | Máy không có camera hay học sinh từ chối quyền | "Không mở được camera. Quét mã QR bằng camera của điện thoại." | es A14 | chưa có | Video HS-5, **thiếu video** |
| T2.5 | Trình duyệt không có `navigator.mediaDevices` | Cùng câu như T2.4, không dựng thẻ video (nhánh `supported` false) | chưa có | chưa có | E2E, **thiếu e2e** |
| T2.6 | Bấm Đóng hộp thoại | Về Chưa có trường, camera tắt | es A14; esql A16 (chưa kiểm camera tắt) | chưa có | E2E |
| T2.7 | Quét QR lúc mạng lỗi, bấm Thử lại | Vào B1 của trường vừa quét | esq A18 | chưa có | E2E |
| T2.8 | Quét QR có id đúng dạng mà trường không có | Chưa có trường | chưa có | chưa có | E2E, **thiếu e2e** |
| T2.9 | Quét QR của trường đã đóng | Trường đã đóng | chưa có | chưa có | E2E, **thiếu e2e** |

### T3. Màn Đổi trường

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T3.1 | Máy có hồ sơ ở trường A mở link trường B | "Máy này đang dùng A. Link vừa mở là của B.", câu mất thông tin | es A4 | chưa có | Video HS-5, **thiếu video** |
| T3.2 | Bấm Giữ trường cũ | Về hồ sơ A đúng bước | es A4 | chưa có | Video HS-5, **thiếu video** |
| T3.3 | Bấm Đổi trường | Xoá token, lưu B, vào B1 của B; hồ sơ A còn trong DB | es A4 | chưa có | Video HS-5, **thiếu video** |
| T3.4 | Mở link B lúc mất mạng, Thử lại | Vẫn hiện Đổi trường | es A17 | chưa có | E2E |
| T3.5 | Trường B đã đóng | Vẫn hỏi; đổi xong thấy Trường đã đóng, mất hồ sơ A (ca sót 14, chờ chủ dự án) | chưa có | chưa có | E2E, **thiếu e2e** |
| T3.6 | Đọc trường A lỗi mạng hoặc 5xx lúc dựng màn hỏi | Không tải được, Thử lại hỏi lại | chưa có | chưa có | E2E, **thiếu e2e** |
| T3.7 | Trường A đã bị xoá (404) | Đổi sang B luôn, không hỏi | chưa có | chưa có | E2E, **thiếu e2e** |

### T4. Màn Trường đã đóng

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T4.1 | Máy mới mở link trường đã đóng | "Trường đã đóng" kèm tên trường | es A3 | chưa có | Video HS-5, **thiếu video** |
| T4.2 | Máy đã lưu trường, chưa có hồ sơ, trường đóng, tải lại | Trường đã đóng | es A3 (phần tải lại) | chưa có | E2E |
| T4.3 | Trường đóng sau khi mở B1, bấm Tiếp tục | 409 "Trường đã đóng." dưới form, không tạo hồ sơ | es B12 | chưa có | E2E |
| T4.4 | Hồ sơ ở B2, trường đóng, bấm Tiếp tục | 409, web tải lại, màn Trường đã đóng, không giữ chỗ | esb C8 | chưa có | E2E |
| T4.5 | Hồ sơ `no_bank`, trường đóng | Trường đã đóng | chưa có | chưa có | E2E, **thiếu e2e** |
| T4.6 | Hồ sơ ở B3, trường đóng | Vẫn B3, ẩn Quay lại, nộp ảnh và gửi được | esb D10 | chưa có | E2E |
| T4.7 | Hồ sơ đã gửi hay có kết quả, trường đóng | Vẫn thấy màn kết quả | chưa có | chưa có | E2E, **thiếu e2e** |
| T4.8 | Tên trường dài có `<script>`, emoji, chuỗi liền | Chữ nguyên văn, không alert, không cuộn ngang | es A3 (A5, B13) | chưa có | E2E |

### T5. Màn Không tải được và nút Thử lại

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T5.1 | Mất mạng lúc mở web | "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." | es A9 | chưa có | Video HS-5, **thiếu video** |
| T5.2 | `/api/customers/me` trả 502 HTML | "Thử lại sau ít phút.", không câu mạng, không "Không lưu được" | es A8 | chưa có | E2E |
| T5.3 | `/api/customers/me` trả 500 hay 429 | Cùng câu T5.2 | chưa có | chưa có | E2E, **thiếu e2e** |
| T5.4 | `/api/schools/<id>` trả 5xx | "Thử lại sau ít phút." | chưa có | chưa có | E2E, **thiếu e2e** |
| T5.5 | Bấm Thử lại khi đã có mạng | Vào đúng bước | es A8, A9 | chưa có | Video HS-5, **thiếu video** |
| T5.6 | Bấm Thử lại khi mạng vẫn lỗi, bấm thêm | "Đang thử lại", `aria-disabled`, không gửi thêm, tiêu điểm ở nút | es A19 | chưa có | E2E |
| T5.7 | Thử lại sau lỗi lúc mở link hay quét QR | Vào B1 của trường đó, hoặc hỏi Đổi trường | es A17; esq A18 | chưa có | E2E |
| T5.8 | Request treo không trả lời | Màn "Đang tải" không có nút (ca sót 7, chờ chủ dự án) | chưa có | chưa có | E2E khi chủ dự án chốt |

### T6. B1 Khai thông tin

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T6.1 | Điền đủ 5 ô hợp lệ, bấm Tiếp tục | 201, lưu id và token, sang B2 | st-1 | V4 "Khai thông tin học sinh và phụ huynh" | Video HS-1 |
| T6.2 | Còn ô sai | Nút Tiếp tục khoá, lỗi hiện dưới ô khi rời ô | es B1 | V4 "Khai thông tin học sinh và phụ huynh" | Video HS-1 |
| T6.3 | Bỏ trống hay chỉ khoảng trắng từng ô | "Nhập họ và tên", "Nhập lớp", câu SĐT, "Nhập họ và tên phụ huynh" | es B1, B2 | chưa có | E2E |
| T6.4 | Họ tên 100 ký tự, 101 ký tự | 100 qua; 101 "Tối đa 100 ký tự" | es B3 | chưa có | E2E |
| T6.5 | Họ tên có khoảng trắng thừa, `<img onerror>`, `'; DROP TABLE`, emoji | Lưu bản gọn, hiện nguyên văn, không alert | es B4, B5 | chưa có | E2E |
| T6.6 | Ký tự điều khiển, nửa emoji | 400 "Có ký tự không hợp lệ" | esa G2 | chưa có | E2E |
| T6.7 | Lớp "11 a3"; lớp 21 ký tự | Lưu 11A3; 21 ký tự "Tối đa 20 ký tự" | es B6; st-1 | V4 "Khai thông tin học sinh và phụ huynh" | Video HS-1 |
| T6.8 | SĐT 9 số, 11 số, đầu 1, +84, có gạch, chữ | "SĐT phải có 10 số, bắt đầu bằng 0." | es B6 (B7) | chưa có | E2E |
| T6.9 | SĐT có dấu cách, dấu chấm | Qua | es B6 (B8); st-1 | V4 "Khai thông tin học sinh và phụ huynh" | E2E |
| T6.10 | SĐT phụ huynh trùng SĐT học sinh, khác cách viết | "SĐT phụ huynh phải khác SĐT học sinh." dưới ô SĐT phụ huynh | es B6 (B9); st-1 | V4 "Khai thông tin học sinh và phụ huynh" | Video HS-1 |
| T6.11 | Enter ở ô cuối, Enter hai lần, bấm đúp | Gửi bằng Enter; một hồ sơ | es B10 | chưa có | E2E |
| T6.12 | Mất mạng lúc bấm Tiếp tục | Câu mạng dưới form, nút bật lại | es B11 | chưa có | E2E |
| T6.13 | Trường bị xoá sau khi mở form | 404 "Không tìm thấy trường." dưới form | chưa có (esa G3 chỉ gọi API) | chưa có | E2E, **thiếu e2e** |
| T6.14 | Ngân hàng đã tick bị xoá | 400 "Ngân hàng không có trong danh sách." dưới form | chưa có (esa G4 chỉ gọi API) | chưa có | E2E, **thiếu e2e** |
| T6.15 | Máy chủ trả lỗi có `field` là một trong 5 ô | Câu hiện dưới ô đó, sửa ô thì câu mất | chưa có | chưa có | E2E, **thiếu e2e** |
| T6.16 | Tải lại khi đang gõ dở | Form trống, đúng trường | es A12 | chưa có | E2E |
| T6.17 | Hai tab cùng gửi B1 | Hai hồ sơ, tab gửi sau ghi đè token (ca sót 10) | chưa có | chưa có | E2E, **thiếu e2e** |
| T6.18 | Họ tên gõ bằng bộ gõ tổ hợp (NFD) | Code không chuẩn hoá NFC (ca sót 15, chờ chủ dự án) | chưa có | chưa có | E2E, **thiếu e2e** |

### T7. B1 Ngân hàng đã có tài khoản

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T7.1 | Trường có ngân hàng trong chương trình | Khối tick có logo, tên, câu "Chưa có thì bỏ trống" | st-1 | V4 "Khai thông tin học sinh và phụ huynh" (thấy, không tick) | Video HS-1 |
| T7.2 | Tick một ngân hàng, Tiếp tục | Ngân hàng đó không có ở B2 | st-1 | chưa có | Video HS-1, **thiếu video** |
| T7.3 | Tick rồi bỏ tick | Ngân hàng không gửi đi, vẫn có ở B2 | chưa có | chưa có | E2E, **thiếu e2e** |
| T7.4 | Trường chưa có ngân hàng nào | Không có khối tick; gửi xong thấy màn hết lượt (ruling B14 chờ chủ dự án) | es B14 | chưa có | E2E |
| T7.5 | Ngân hàng đang hết lượt | Vẫn có ô tick | es B16 | chưa có | E2E |
| T7.6 | Tick đủ mọi ngân hàng | Màn "Không có ngân hàng nào phù hợp" | es B15, B16 | chưa có | Video HS-3, **thiếu video** |
| T7.7 | Tên ngân hàng dài có và không dấu cách | Ô tick 18 px, không tràn | es A3 (B13), B17 | chưa có | E2E |

### T8. B2 Chọn ngân hàng

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T8.1 | Còn từ 2 ngân hàng, chọn 2, Tiếp tục | Dấu tích, "Đã chọn 2/2.", 204, sang B3; ngân hàng chọn trước là tab đầu | st-1 | V4 "Chọn 2 ngân hàng: hiện dấu tích, không ghi Ngân hàng 1, 2", "Chọn lại 2 ngân hàng" | Video HS-1 |
| T8.2 | Mới chọn 1 | Nút Tiếp tục khoá, "Đã chọn 1/2." | es A12; esb C1 | chưa có | E2E |
| T8.3 | Đã chọn 2, bấm ngân hàng thứ 3; bỏ chọn 1 | Thứ 3 khoá; bỏ chọn thì mở lại | esb C1 | chưa có | E2E |
| T8.4 | Bỏ chọn ngân hàng chọn trước | Ngân hàng còn lại lên vị trí 1, là tab đầu ở B3 | chưa có | chưa có | E2E, **thiếu e2e** |
| T8.5 | Còn đúng 1 ngân hàng | Chọn sẵn, "Chọn ngân hàng", "Chỉ còn 1 ngân hàng chưa có tài khoản." | esb C2, C4 | chưa có | Video HS-3, **thiếu video** |
| T8.6 | Còn 1 vì đã có các ngân hàng khác | Thêm dòng "Đã có: <tên>." | chưa có | chưa có | Video HS-3, **thiếu e2e**, **thiếu video** |
| T8.7 | Hết lượt mọi ngân hàng chưa có | "Ngân hàng đã hết lượt trong tháng này", khối Zalo | esb C3; es B14; esr F8 | chưa có | Video HS-3, **thiếu video** |
| T8.8 | Đã có mọi ngân hàng (`no_bank`) | "Không có ngân hàng nào phù hợp", không nút quay lại, khối Zalo | es B15, B16; esr F8 | chưa có | Video HS-3, **thiếu video** |
| T8.9 | Đang xem 2, người khác lấy lượt cuối | 409 "Ngân hàng vừa hết lượt. Chọn lại.", còn 1 chọn sẵn | esb C4 | chưa có | E2E |
| T8.10 | Đang xem 1, lượt trả lại thành 2 | 400 ô `bankIds`, tải lại, chọn 2, câu gợi ý một lần | esb C2 (C5) | chưa có | E2E |
| T8.11 | Đang xem, mọi ngân hàng hết lượt cùng lúc | 409 "Ngân hàng đã hết lượt trong tháng này.", tải lại sang màn hết lượt | chưa có | chưa có | E2E, **thiếu e2e** |
| T8.12 | Đang xem, ngân hàng bị tắt hay gỡ mã nên ngân hàng đã có phủ hết | 409 "Không còn ngân hàng nào phù hợp.", hồ sơ thành `no_bank`, tải lại | chưa có | chưa có | E2E, **thiếu e2e** |
| T8.13 | Hai tab, tab kia giữ chỗ trước | 409 "Hồ sơ đã chọn ngân hàng.", tải lại sang B3 với ngân hàng tab kia | esb C9 | chưa có | E2E |
| T8.14 | Bấm đúp Tiếp tục | Giữ chỗ một lần | esb C7 | chưa có | E2E |
| T8.15 | Mất mạng lúc bấm Tiếp tục | Câu mạng, nút bật lại | chưa có | chưa có | E2E, **thiếu e2e** |
| T8.16 | Tải lại ở B2 | Chưa chọn ngân hàng nào | es A12 | chưa có | E2E |
| T8.17 | Tên ngân hàng dài | Nút, dấu tích nằm trong màn, không cuộn ngang | esb C6 | chưa có | E2E |
| T8.18 | Qua 00:00 ngày đầu tháng lúc đang ở B2 | Lượt tính theo tháng mới (ca sót 7 lượt 3) | chưa có | chưa có | E2E, **thiếu e2e** |
| T8.19 | Mã chép vào hồ sơ | Mã ưu tiên cao nhất còn lượt; cùng ưu tiên thì mã tạo trước (`pickCode`) | chưa có (có test DB `tests/db/reserve.test.ts`) | chưa có | E2E, **thiếu e2e** |

### T9. B3 Hướng dẫn, mã giới thiệu, nút Quét QR code

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T9.1 | Ngân hàng có hướng dẫn | Các bước đánh số theo thứ tự | esb D1 (D2) | V4 "Xem hướng dẫn, mã giới thiệu, bấm ảnh mẫu để xem phóng to" | Video HS-1 |
| T9.2 | Ngân hàng chưa cài hướng dẫn | Không có danh sách bước | esb D8 | chưa có | E2E |
| T9.3 | Mã giới thiệu dạng chữ | Hiện mã, một cú bấm chọn hết mã | st-1; esb D5 | V4 "Xem hướng dẫn, mã giới thiệu, bấm ảnh mẫu để xem phóng to" | Video HS-1 |
| T9.4 | Bấm Sao chép, trình duyệt cho chép | "Đã sao chép" ở vùng `aria-live`, mất sau 2 giây | esb D4 | chưa có | Video HS-1, **thiếu video** |
| T9.5 | Bấm Sao chép trong app Zalo hay trang http | "Không sao chép được", mất sau 2 giây | esb D5 | chưa có | E2E |
| T9.6 | Mã có ảnh QR | Ảnh QR 96 px cạnh mã | esb D18 (chỉ ca link hết hạn) | chưa có | Video HS-1, **thiếu video** |
| T9.7 | Mã có link | Nút "Quét QR code" mở link ở tab mới | st-1; esb D1 (D6) | V4 "Bấm Quét QR code mở trang mở tài khoản của ngân hàng" | Video HS-1 |
| T9.8 | Mã không có link | Không có nút Quét QR code | esb D1 | chưa có | E2E |
| T9.9 | Link có dấu cách | `href` đã mã hoá | esb D1 (D6) | chưa có | E2E |
| T9.10 | Mã không có chữ, chỉ có ảnh QR | Chỉ ảnh QR, không chữ "Mã giới thiệu", không nút Sao chép | chưa có | chưa có | E2E, **thiếu e2e** |
| T9.11 | Mã 55 ký tự liền | Mã xuống dòng, nút Sao chép trong khung | esb D1 (D3) | chưa có | E2E |
| T9.12 | Link ảnh QR hết hạn (403) | Ô QR giữ 96 px | esb D18 | chưa có | E2E |

DB bắt mã phải có chữ hoặc ảnh QR (`referral_codes_code_or_qr`), nên ca khối mã rỗng hoàn toàn không xảy ra.

### T10. B3 Ảnh mẫu

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T10.1 | Bấm ảnh mẫu | Hộp xem ảnh lớn, chú thích "1. <tên khung>", nút Đóng | st-1; esb D1 (D7) | V4 "Xem hướng dẫn, mã giới thiệu, bấm ảnh mẫu để xem phóng to" | Video HS-1 |
| T10.2 | Khung chưa có ảnh mẫu | "Chưa có ảnh mẫu" | esb D1 (D7) | chưa có | E2E |
| T10.3 | Ngân hàng có nhiều ảnh mẫu | Hộp xem có Ảnh trước, Ảnh sau, phím mũi tên | chưa có | chưa có | E2E, **thiếu e2e** |
| T10.4 | Link ảnh mẫu hết hạn | Khung giữ 160 px, chữ "Ảnh mẫu" | esb D18 | chưa có | E2E |
| T10.5 | Tên khung dài | Chú thích không tràn | esb D1 (D7) | chưa có | E2E |

### T11. B3 Nộp ảnh từng khung

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T11.1 | Chọn ảnh vào khung trống | "Đang tải ảnh", rồi ảnh có "Đã gửi", "Chọn lại"; số "Ảnh cần nộp x/y" tăng | st-1 (chưa kiểm số đếm) | V4 "Nộp ảnh mọi khung: khung ghi Đã gửi, tab có dấu đủ ảnh" | Video HS-1 |
| T11.2 | Chọn lại khung đã có ảnh | Ảnh mới thay ảnh cũ, ảnh cũ xoá khỏi S3 | st-2 | chưa có | Video HS-1, **thiếu video** |
| T11.3 | Đang tải một khung | Khung đó khoá, khung khác tải được, Gửi kiểm tra khoá | st-2; esp E8 | chưa có | E2E |
| T11.4 | Mất mạng lúc tải | "Không tải được ảnh lên. Kiểm tra mạng rồi thử lại.", chọn lại được | st-2 | chưa có | E2E |
| T11.5 | File chữ đổi đuôi .jpg | "Chỉ nhận ảnh jpg, png, webp hoặc heic.", khung trống | esp E1 | chưa có | E2E |
| T11.6 | File .txt | "Không mở được ảnh này. Chọn ảnh khác.", không gửi | esp E2 | chưa có | E2E |
| T11.7 | File 0 byte | "File rỗng." | esp E3 | chưa có | E2E |
| T11.8 | HEIC 21 MB máy không mở được | "Ảnh lớn hơn 20 MB." ở máy, không gửi | esp E4 | chưa có | E2E |
| T11.9 | HEIC thật | Gửi bản gốc, máy chủ đổi WebP, "Đã gửi" | esp E5 | chưa có | E2E |
| T11.10 | JPEG 6000x8000; PNG 1x1 | Nén dưới 300 KB; ảnh nhỏ gửi được | esp E6, E7 | chưa có | E2E |
| T11.11 | Ảnh 15 MB qua API | 201, máy chủ đổi WebP | st-3 | chưa có | E2E |
| T11.12 | Body quá 22 MB; file 20,5 MB | 413 và 400 "Ảnh lớn hơn 20 MB." | esa E9, E10 | chưa có | E2E |
| T11.13 | PNG khai 20000x20000; HEIC 8192x8192 | 201 trong 5 giây, giữ bản gốc | esa E11, E12 | chưa có | E2E |
| T11.14 | Khung bị bỏ lúc đang ở B3 | 404, web tải lại, khung biến mất | esb D13 | chưa có | E2E |
| T11.15 | Tab kia Quay lại nên hồ sơ về B2 | 409, web tải lại sang B2, không câu "Hồ sơ đã gửi kiểm tra." | esb D22 | chưa có | E2E |
| T11.16 | Tab kia đã gửi kiểm tra, tab này nộp ảnh | 409, web tải lại sang màn kết quả | chưa có | chưa có | E2E, **thiếu e2e** |
| T11.17 | S3 lỗi khi ghi | 400 "Không tải được ảnh lên kho lưu trữ. Thử lại sau ít phút." | chưa có | chưa có | E2E, **thiếu e2e** |
| T11.18 | Lỗi bất ngờ ở trình duyệt hay dữ liệu lạ | "Không tải được ảnh lên. Thử lại.", khung không kẹt ở Đang tải ảnh | chưa có | chưa có | E2E, **thiếu e2e** |
| T11.19 | Token mất giữa chừng (401) | "Không tìm thấy hồ sơ trên máy này." ở khung | chưa có | chưa có | E2E, **thiếu e2e** |
| T11.20 | Nộp vào dòng của học sinh khác, khung của ngân hàng khác | 404, không ghi ảnh | esa G9 | chưa có | E2E |
| T11.21 | API thiếu file, body không multipart, id sai dạng | 400 "Chọn ảnh.", 400 | chưa có (có test DB `tests/db/studentRoutes.test.ts`) | chưa có | E2E, **thiếu e2e** |
| T11.22 | Tải lại trang ở B3 | Giữ ảnh đã nộp | es A12 | chưa có | E2E |
| T11.23 | Trang ẩn rồi hiện lúc đang nộp, mạng chậm | Ảnh vừa nộp không mất | esb D17 | chưa có | E2E |
| T11.24 | Link ảnh đã nộp hết hạn | Khung vẫn "Đã gửi", giữ 160 px | esb D18 | chưa có | E2E |

### T12. B3 Thanh tab ngân hàng

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T12.1 | Mỗi ngân hàng một tab, bấm tab | Tab đầu là vị trí 1; bấm tab đổi nội dung | st-1 | V4 "Nộp ảnh mọi khung: khung ghi Đã gửi, tab có dấu đủ ảnh" | Video HS-1 |
| T12.2 | Đủ ảnh một ngân hàng | Vòng tròn có dấu ✓, trình đọc màn hình đọc "đủ ảnh" | st-1 | V4 "Nộp ảnh mọi khung: khung ghi Đã gửi, tab có dấu đủ ảnh" | Video HS-1 |
| T12.3 | Cuộn trang | Thanh tab dính đầu màn | esb D1 | V4 "Cuộn xuống: thanh tab ngân hàng dính đầu màn hình" | E2E |
| T12.4 | Phím mũi tên trái phải | Chuyển tab, tiêu điểm theo tab | chưa có | chưa có | E2E, **thiếu e2e** |
| T12.5 | Chỉ 1 ngân hàng | Một tab | esb C4 | chưa có | E2E |
| T12.6 | Tab tên dài cạnh tab tên ngắn | Vòng tròn 16 px, tên ngắn một dòng | esb D19 | chưa có | E2E |

### T13. B3 Quay lại chọn ngân hàng

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T13.1 | Chưa có ảnh, bấm Quay lại | Về B2 không hỏi, trả lượt | esb D9 | chưa có | Video HS-2, **thiếu video** |
| T13.2 | Có ảnh, bấm Quay lại rồi Quay lại trong hộp | Hộp "Xoá ảnh đã nộp và quay lại chọn ngân hàng?", xoá ảnh, về B2 | esb D20, D21 | V4 "Nộp một ảnh rồi Quay lại chọn ngân hàng" | Video HS-2 |
| T13.3 | Có ảnh, bấm Huỷ | Giữ ảnh | esb D9 | chưa có | Video HS-2, **thiếu video** |
| T13.4 | Mạng chậm trong hộp | Huỷ khoá, X và Esc không đóng hộp | esb D20 | chưa có | E2E |
| T13.5 | Mất mạng trong hộp; Huỷ rồi mở lại | Câu mạng trong hộp; mở lại không còn câu cũ | esb D21 | chưa có | E2E |
| T13.6 | Trường vừa đóng, web chưa tải lại | 409, tải lại, ẩn nút, "Trường đã đóng." dưới tab, tiêu điểm ở câu lỗi | esb D14 | chưa có | E2E |
| T13.7 | Trường đã đóng | Không có nút Quay lại | esb D10 | chưa có | E2E |
| T13.8 | Tab kia đã gửi kiểm tra | 409, sang màn kết quả | esb D15 | chưa có | E2E |
| T13.9 | Bấm đúp khi chưa có ảnh | Nút khoá, một request | esb D16 | chưa có | E2E |
| T13.10 | Esc ba lần liền khi hộp đang chạy | Chrome đóng hộp, request vẫn chạy (đã biết, không sửa) | chưa có | chưa có | Không cần |

### T14. B3 Gửi kiểm tra

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T14.1 | Đủ ảnh mọi khung mọi ngân hàng, bấm Gửi kiểm tra | 204, sang màn chờ | st-1 | V4 "Gửi kiểm tra, thấy màn chờ" | Video HS-1 |
| T14.2 | Còn khung trống | Nút khoá | st-1; esb D11 | chưa có | Video HS-1, **thiếu video** |
| T14.3 | Bấm đúp | Gửi một lần | esb D11 | chưa có | E2E |
| T14.4 | Đang tải hay chọn lại ảnh | Nút khoá tới khi xong | st-2; esp E8 | chưa có | E2E |
| T14.5 | Ngân hàng không có khung ảnh nào | Coi như đủ ảnh (ruling D8 chờ chủ dự án) | esb D8 | chưa có | E2E |
| T14.6 | Người quản lý vừa thêm khung | 400 "Còn khung chưa có ảnh.", tải lại hiện khung mới; nộp xong câu mất | esb D12 | chưa có | E2E |
| T14.7 | Tab kia đã gửi | 409 "Hồ sơ đã gửi kiểm tra.", tải lại sang màn kết quả | es A13 | chưa có | E2E |
| T14.8 | Mất mạng lúc gửi | Câu mạng, nút bật lại, web không tải lại | chưa có | chưa có | E2E, **thiếu e2e** |
| T14.9 | API: còn khung trống, gửi lần hai | 400, 409 | esa G8 | chưa có | E2E |

### T15. Màn chờ và kết quả

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T15.1 | Ngay sau khi gửi | "<Họ tên> - <Lớp>", "Đã gửi <ngày giờ>. Nhân viên kiểm tra trong giờ làm việc.", mỗi ngân hàng "Chờ kiểm tra", không nút gửi | st-1; esr F1 | V4 "Gửi kiểm tra, thấy màn chờ" | Video HS-1 |
| T15.2 | Máy đặt múi giờ khác, gửi lúc 23:30 và 00:30 giờ Việt Nam | Giờ Việt Nam đúng ngày | esr F1 (F5) | chưa có | E2E |
| T15.3 | Một ngân hàng Đạt, ngân hàng kia còn chờ | Vẫn câu "Đã gửi ...", nhãn Đạt và Chờ kiểm tra, có khối App PVI | rv (chỉ kiểm khối PVI, không kiểm nhãn và câu) | chưa có | Video HS-4, **thiếu video** |
| T15.4 | Đạt một, Không đạt một | "Kiểm tra xong <ngày giờ>", nhãn chữ, khối App PVI, không lý do, không câu gọi phụ huynh | esr F3 (F6) | chưa có | Video HS-4, **thiếu video** |
| T15.5 | Đạt cả hai | Hai nhãn Đạt, khối App PVI | chỉ flow 05 | V5 "Học sinh mở lại web: chỉ thấy QR và nút Mở app PVI, không có chữ voucher" | Video HS-4 |
| T15.6 | Không đạt cả hai | Hai nhãn Không đạt, không có khối App PVI, chỉ khối Zalo | chưa có | chưa có | Video HS-4, **thiếu e2e**, **thiếu video** |
| T15.7 | Có ngân hàng Không đạt | Không có nút gửi lại, không có ô chọn ảnh | esr F3 (F7, chỉ kiểm không có nút Gửi kiểm tra) | chưa có | Video HS-4, **thiếu video** |
| T15.8 | Hậu kiểm đổi Không đạt sang Đạt | Học sinh thấy Đạt | chỉ flow 05 | V5 "Học sinh mở lại web: chỉ thấy QR và nút Mở app PVI, không có chữ voucher" | E2E |
| T15.9 | Họ tên 100 ký tự liền, lớp 20 ký tự, tên ngân hàng dài | Xuống dòng, không cuộn ngang | esr F1 (F2) | chưa có | E2E |
| T15.10 | Tải lại màn kết quả | Giữ trạng thái, không nút Gửi kiểm tra | st-1; esr F3 (F7) | V4 "Gửi kiểm tra, thấy màn chờ" | E2E |
| T15.11 | Nhãn "Đang tạo" (`selected`) | Code có nhãn, màn kết quả không gặp trạng thái này | chưa có | chưa có | Không cần |

### T16. Khối App PVI (voucher)

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T16.1 | Có voucher, có link app PVI | QR "QR mở app PVI" và nút "Mở app PVI" mở tab mới | esr F3; rv | V5 "Học sinh mở lại web: chỉ thấy QR và nút Mở app PVI, không có chữ voucher" | Video HS-4 |
| T16.2 | Có voucher | Không chữ voucher, không mã voucher, không dòng SMS | esr F3; rv | V5 "Học sinh mở lại web: chỉ thấy QR và nút Mở app PVI, không có chữ voucher" | E2E |
| T16.3 | Chưa có voucher | Không có khối | esr F1 (F4) | chưa có | E2E |
| T16.4 | Có voucher mà link app PVI trống | Không có khối | chưa có | chưa có | E2E, **thiếu e2e** |
| T16.5 | Bấm Mở app PVI | Mở link ở tab mới | chưa có (chỉ kiểm `href`, `target`) | chưa có | Video HS-4, **thiếu e2e**, **thiếu video** |

### T17. Khối Zalo

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T17.1 | Có link Zalo, màn hết lượt | QR, "Cần hỏi: kết bạn Zalo với nhân viên.", mở tab mới | esr F8 | chưa có | Video HS-3, **thiếu video** |
| T17.2 | Có link Zalo, màn Không có ngân hàng nào phù hợp | "Khai nhầm ngân hàng đã có: kết bạn Zalo để nhân viên sửa." | esr F8 (không kiểm câu) | chưa có | Video HS-3, **thiếu video** |
| T17.3 | Có link Zalo, màn kết quả | "Cần hỏi: kết bạn Zalo với nhân viên." | esr F8 | chưa có | Video HS-4, **thiếu video** |
| T17.4 | Link Zalo trống (mặc định) | Không có khối Zalo | chưa có | chưa có | E2E, **thiếu e2e** |
| T17.5 | Link Zalo dài | QR và chữ gọn trong khổ 390 px | esr F8 | chưa có | E2E |

### T18. Mở lại web, token, đổi máy

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T18.1 | Mở lại `/` có token | Vào đúng bước: B2, B3, màn chờ, kết quả | es A12; esr F1; st-1 | V5 "Học sinh mở lại web: chỉ thấy QR và nút Mở app PVI, không có chữ voucher" (chỉ màn kết quả) | Video HS-4 |
| T18.2 | Từ app ngân hàng quay lại web | Trang hiện lại thì tải lại hồ sơ, link ảnh mới | esb D17 (chỉ ca mạng chậm) | chưa có | E2E |
| T18.3 | Token sai hay hồ sơ không còn | 401, quên token, hiện B1 của trường đang lưu | es A6; esa G6 | chưa có | E2E |
| T18.4 | Token hết hạn | Không áp dụng: token không có hạn (quyết định "không khôi phục token") | chưa có | chưa có | Không cần |
| T18.5 | Đổi máy hay xoá dữ liệu trình duyệt, mở lại link | B1 trống, khai lại tạo hồ sơ thứ hai | chưa có | chưa có | E2E, **thiếu e2e** |

### T19. Logo ngân hàng

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T19.1 | Ngân hàng có logo | Logo trên nền trắng ở B1 và B2 | st-1 (ảnh tải được) | V4 "Khai thông tin học sinh và phụ huynh", "Chọn 2 ngân hàng: hiện dấu tích, không ghi Ngân hàng 1, 2" | Video HS-1 |
| T19.2 | Ngân hàng chưa có logo | Ô xám có icon ngân hàng, tỉ lệ 8:3 | chưa có (es B17, esb C6 chỉ đo khung) | chưa có | E2E, **thiếu e2e** |
| T19.3 | Link logo hết hạn (403) | Ô giữ tỉ lệ, không vỡ khung | chưa có | chưa có | E2E, **thiếu e2e** |

### T20. Khung trang: khổ màn, chữ dài, sáng tối

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T20.1 | Khổ 390x844 | Mọi màn không cuộn ngang | es, esb, esr (đo ở A5, C6, D1, F1...) | V4 | E2E |
| T20.2 | Khổ 320 và 360 | Không cuộn ngang, nút trọn màn | chưa có | chưa có | E2E, **thiếu e2e** |
| T20.3 | Máy đặt chế độ tối | Web học sinh vẫn sáng (giải thích dưới bảng) | chưa có | chưa có | E2E, **thiếu e2e** |
| T20.4 | localStorage `theme` là `dark` trên tên miền học sinh | Token màu tối, logo nằm trên nền trắng | chưa có | chưa có | E2E khi chủ dự án chốt |

Giao diện tối: `src/app/layout.tsx` chỉ bật tối khi localStorage `theme` là `dark`. Chỉ `Sidebar` của trang quản lý ghi khoá này.
Trang quản lý và web học sinh khác tên miền, nên localStorage tách riêng. Web học sinh không có nút đổi giao diện, cũng không đọc `prefers-color-scheme`.
Vậy học sinh luôn thấy giao diện sáng. Chủ dự án phải chốt: giữ sáng, hay theo chế độ của máy. Chưa chốt thì e2e chỉ cần khẳng định web sáng khi máy đặt tối.

### T21. API học sinh gọi thẳng

| Mã | Ca | Kết quả đúng (theo code) | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| T21.1 | `POST /api/customers` thiếu Origin, Origin lạ, Origin trang quản lý | 403 | esa G1 | chưa có | E2E |
| T21.2 | Body không phải JSON, `[]`, `null`, họ tên là số | 400 câu tiếng Việt | esa G2 | chưa có | E2E |
| T21.3 | `schoolId` sai dạng, không có, trường đóng | 400, 404, 409 | esa G3 | chưa có | E2E |
| T21.4 | `existingBankIds` 51 phần tử, id lạ | 400 | esa G4 | chưa có | E2E |
| T21.5 | `GET /api/schools/<id sai>` | 404 | esa G5 | chưa có | E2E |
| T21.6 | `GET /api/customers/me` thiếu token, sai dạng, 43 ký tự lạ | 401 | esa G6 | chưa có | E2E |
| T21.7 | Giữ chỗ trùng ngân hàng, ngoài trường, lần hai | 400, 409, 409 | esa G7 | chưa có | E2E |
| T21.8 | Giữ chỗ mảng rỗng, 3 phần tử, id sai dạng | 400 "Chọn ngân hàng", "Chọn tối đa 2 ngân hàng", "Dữ liệu không hợp lệ." | chưa có | chưa có | E2E, **thiếu e2e** |
| T21.9 | Route ghi (banks, photos, submit) có token mà Origin lạ | 403 | chưa có (có test DB `tests/db/studentRoutes.test.ts`) | chưa có | E2E, **thiếu e2e** |
| T21.10 | `DELETE /api/customers/me/banks` khi không ở B3 | 409 "Hồ sơ không ở bước mở tài khoản." | esb D15 (qua giao diện) | chưa có | E2E |
| T21.11 | `GET /api/schools/<id trường đóng>` | 200, `active` false, `banks` rỗng | es A3 (qua giao diện) | chưa có | E2E |

## 3. Chỗ thiếu e2e, xếp theo mức nên làm trước

1. Luồng học sinh hay gặp mà chưa có test: T1.7 quét lại QR trường mình, T1.6 đổi trường khi chưa có hồ sơ, T15.6 Không đạt cả hai, T8.6 dòng "Đã có:", T18.5 đổi máy, T16.5 bấm Mở app PVI.
2. Trạng thái cũ ở máy chủ chưa có test: T8.11, T8.12, T11.16, T3.6, T3.7, T1.5, T4.5, T4.7.
3. Lỗi mạng và máy chủ chưa có test: T8.15, T14.8, T11.17, T11.18, T11.19, T5.3, T5.4.
4. Nhánh hiển thị chưa có test: T2.5, T9.10, T10.3, T12.4, T17.4, T16.4, T19.2, T19.3, T20.2, T20.3, T8.4, T7.3.
5. Nhánh chỉ gọi API hay chỉ có test DB: T6.13, T6.14, T6.15, T21.8, T21.9, T11.21, T8.19, T2.8, T2.9.
6. Chờ chủ dự án quyết trước khi viết: T1.8, T3.5, T5.8, T6.17, T6.18, T8.18, T20.4, T7.4 (B14), T14.5 (D8).

## 4. Đề xuất video

### Điều kiện chung cho video người dùng cuối

Video hiện có quay cho chủ dự án duyệt. Muốn cho học sinh xem thẳng thì phải sửa các điểm sau. Chưa sửa điểm nào.

- `e2e/flows/video.ts` bật `show.test` và `show.actions`. Góc trái trên ghi tên file `04-hoc-sinh.spec.ts`, tên test, tên bước kiểu kỹ thuật ("không ghi Ngân hàng 1, 2"). Góc phải dưới ghi locator tiếng Anh, có chữ "ZZE2E HS VPBank". Video người dùng phải tắt hai lớp này, hoặc đặt tên bước thành câu hướng dẫn.
- Dữ liệu video phải dùng tên trường, tên ngân hàng không tiền tố (mục 5).
- Ảnh mẫu và ảnh nộp hiện là `public/brand/photo.jpg`, ảnh 276x276 của thương hiệu. Video hướng dẫn cần ảnh màn hình thật của app ngân hàng do chủ dự án cấp.
- Mã giới thiệu của seed video không có ảnh QR, nên T9.6 không hiện. Seed video phải có mã kèm ảnh QR.
- Link Zalo của DB local mặc định rỗng. Mọi flow hiện có không hiện khối Zalo. Video HS-3, HS-4 phải cài link Zalo.
- Video không ghi được thao tác ngoài trình duyệt: camera điện thoại quét QR dán ở trường, chọn ảnh từ thư viện, chụp màn hình app ngân hàng. Cần khung chữ `note()` ở đáy video nói thao tác đó. Quét QR trong web thì quay được bằng camera giả `qrCamera`.
- Flow 5 quay màn học sinh ở trình duyệt máy tính thu về 390 px. Video học sinh nên dùng `isMobile` như flow 4.

### Video cho học sinh (điện thoại 390x844)

**HS-1. Mở tài khoản 2 ngân hàng, từ quét QR tới gửi kiểm tra.** Nền là flow 4. Bỏ bước "Cuộn xuống: thanh tab..." khỏi video người dùng (giữ ở e2e). Chuyển bước Quay lại sang HS-2.

| Thứ tự | Bước | Ca | Hiện có |
|---|---|---|---|
| 1 | Mở link QR của trường, thấy tên trường và form Thông tin | T1.1 | V4 "Mở link QR của trường" |
| 2 | Khai họ tên, lớp, SĐT, phụ huynh. SĐT phụ huynh trùng thì thấy lỗi dưới ô, sửa lại | T6.1, T6.2, T6.7, T6.10 | V4 "Khai thông tin học sinh và phụ huynh" |
| 3 | Tick ngân hàng đã có tài khoản | T7.1, T7.2, T19.1 | **Thiếu** (flow 4 không tick) |
| 4 | Chọn 2 ngân hàng, thấy dấu tích và "Đã chọn 2/2." | T8.1 | V4 "Chọn 2 ngân hàng: hiện dấu tích, không ghi Ngân hàng 1, 2" |
| 5 | Đọc các bước hướng dẫn ở tab ngân hàng 1 | T9.1, T12.1 | V4 "Xem hướng dẫn, mã giới thiệu, bấm ảnh mẫu để xem phóng to" |
| 6 | Bấm Sao chép mã giới thiệu, thấy "Đã sao chép" | T9.3, T9.4 | **Thiếu** |
| 7 | Thấy ảnh QR mã giới thiệu | T9.6 | **Thiếu** (seed không có ảnh QR) |
| 8 | Bấm Quét QR code, trang mở tài khoản của ngân hàng mở ra | T9.7 | V4 "Bấm Quét QR code mở trang mở tài khoản của ngân hàng" |
| 9 | Bấm ảnh mẫu xem lớn, bấm Đóng | T10.1 | V4 "Xem hướng dẫn, mã giới thiệu, bấm ảnh mẫu để xem phóng to" |
| 10 | Chọn ảnh từng khung: Đang tải ảnh, rồi Đã gửi, số Ảnh cần nộp tăng. Nút Gửi kiểm tra còn khoá | T11.1, T14.2 | V4 "Nộp ảnh mọi khung..." (chưa nêu số đếm và nút khoá) |
| 11 | Chọn lại một ảnh đã nộp | T11.2 | **Thiếu** |
| 12 | Sang tab ngân hàng 2, nộp đủ; hai tab có dấu đủ ảnh | T12.1, T12.2 | V4 "Nộp ảnh mọi khung: khung ghi Đã gửi, tab có dấu đủ ảnh" |
| 13 | Bấm Gửi kiểm tra, thấy màn chờ "Chờ kiểm tra" | T14.1, T15.1 | V4 "Gửi kiểm tra, thấy màn chờ" |

**HS-2. Đổi ngân hàng đã chọn.**

| Thứ tự | Bước | Ca | Hiện có |
|---|---|---|---|
| 1 | Ở bước Mở tài khoản, chưa nộp ảnh, bấm Quay lại chọn ngân hàng: về bước chọn ngay | T13.1 | **Thiếu** |
| 2 | Chọn lại 2 ngân hàng | T8.1 | V4 "Chọn lại 2 ngân hàng" |
| 3 | Nộp một ảnh, bấm Quay lại, hộp hỏi hiện, bấm Huỷ: ảnh còn | T13.3 | **Thiếu** |
| 4 | Bấm Quay lại lần nữa, chọn Quay lại: ảnh xoá, về bước chọn | T13.2 | V4 "Nộp một ảnh rồi Quay lại chọn ngân hàng" |

**HS-3. Không chọn được 2 ngân hàng.**

| Thứ tự | Bước | Ca | Hiện có |
|---|---|---|---|
| 1 | Chỉ còn 1 ngân hàng: web chọn sẵn, thấy dòng "Đã có:", bấm Tiếp tục, B3 có một tab | T8.5, T8.6, T12.5 | **Thiếu** |
| 2 | Ngân hàng hết lượt trong tháng: màn dừng, QR Zalo để hỏi | T8.7, T17.1 | **Thiếu** |
| 3 | Đã có tài khoản mọi ngân hàng: màn dừng, QR Zalo khi khai nhầm | T7.6, T8.8, T17.2 | **Thiếu** |

**HS-4. Mở lại web xem kết quả.**

| Thứ tự | Bước | Ca | Hiện có |
|---|---|---|---|
| 1 | Đóng web, quét lại QR trường: vào thẳng màn đang dở | T1.7, T18.1 | **Thiếu** (V5 chỉ mở `/` sau hậu kiểm) |
| 2 | Màn chờ: giờ gửi, Chờ kiểm tra | T15.1 | V4 "Gửi kiểm tra, thấy màn chờ" |
| 3 | Một ngân hàng Đạt, một còn chờ: khối App PVI hiện | T15.3, T16.1 | **Thiếu** |
| 4 | Bấm Mở app PVI | T16.5 | **Thiếu** |
| 5 | Kiểm tra xong, Đạt một Không đạt một: không có nút gửi lại | T15.4, T15.7 | **Thiếu** |
| 6 | Đạt cả hai | T15.5 | V5 "Học sinh mở lại web: chỉ thấy QR và nút Mở app PVI, không có chữ voucher" |
| 7 | Không đạt cả hai: không có khối PVI, QR Zalo để hỏi | T15.6, T17.3 | **Thiếu** |

**HS-5. Mở web không qua link, đổi trường, lỗi mạng.**

| Thứ tự | Bước | Ca | Hiện có |
|---|---|---|---|
| 1 | Mở web khi chưa quét QR: "Chưa có trường" | T2.1 | V4 "Mở web khi chưa quét QR" |
| 2 | Bấm Quét mã QR, đưa QR trường vào khung: vào form Thông tin | T2.2 | **Thiếu** (có e2e esq A15) |
| 3 | Quét nhầm QR khác: "Mã QR này không phải của trường." | T2.3 | **Thiếu** |
| 4 | Không mở được camera: câu bảo quét bằng camera của điện thoại | T2.4 | **Thiếu** |
| 5 | Máy đang có hồ sơ trường A, mở link trường B: màn Đổi trường. Bấm Giữ trường cũ, rồi mở lại và bấm Đổi trường | T3.1, T3.2, T3.3 | **Thiếu** |
| 6 | Mở link trường đã đóng: "Trường đã đóng" | T4.1 | **Thiếu** |
| 7 | Mất mạng: "Không tải được", bấm Thử lại khi có mạng | T5.1, T5.5 | **Thiếu** |

### Video cho nhân viên hậu kiểm, Manager, Quản trị (phần học sinh)

- Nhân viên hậu kiểm: giữ bước cuối của flow 5 (học sinh thấy QR PVI). Nên thêm cảnh học sinh thấy Đạt một, Không đạt một trước khi đổi sang Đạt (T15.4). Việc này thuộc nhóm nghiệp vụ.
- Quản trị: sau khi lưu link Zalo và link app PVI ở Cài đặt (flow 8), nên cho xem màn học sinh có QR Zalo và QR PVI (T17, T16). Việc này thuộc nhóm cấu hình.
- Manager: phần học sinh không có cảnh riêng cho vai này.

### Ca chỉ cần e2e

Mọi ca có cột Đề xuất ghi "E2E" ở mục 2: ca biên dữ liệu (chữ dài, ký tự đặc biệt, ảnh hỏng, ảnh lớn), ca đồng thời hai tab, ca máy chủ đổi trạng thái giữa chừng, ca API gọi thẳng, ca bàn phím và trình đọc màn hình. Câu báo của các ca này tự giải thích, học sinh không cần xem video.

## 5. Chữ test sẽ hiện trên màn học sinh trong video

| Chữ trên màn | Chỗ hiện | Nguồn | Video |
|---|---|---|---|
| "ZZE2E THPT Học sinh" | Tên trường ở đầu B1, B2, B3, màn chờ, màn kết quả | `scripts/e2e-data.ts` `E2E_STUDENT_SCHOOL`; seed `scripts/e2e-seed.ts` `seedStudentWeb`; spec `e2e/flows/04-hoc-sinh.spec.ts` dòng 36 | Flow 4 trọn video; flow 5 bước học sinh mở lại web |
| "ZZE2E HS MB", "ZZE2E HS VPBank", "ZZE2E HS TPBank" | Ô tick B1, nút chọn B2, tab B3, danh sách màn kết quả | `scripts/e2e-seed.ts` dòng 28 `${E2E_NAME}HS ${b.key}`, `E2E_NAME = "ZZE2E "` ở `scripts/e2e-clean.ts`; `scripts/e2e-data.ts` `E2E_REVIEW_BANK`, `E2E_SECOND_BANK`; spec flow 4 dòng 53, 85, 91, 92; flow 5 dòng 4, 5 | Flow 4, flow 5 |
| `getByRole('button', { name: /ZZE2E HS VPBank/ })` và locator tương tự | Góc phải dưới video, tên thao tác | `e2e/flows/video.ts` `show.actions`; locator ở flow 4 | Flow 4 |
| "04-hoc-sinh.spec.ts", "Flow 4: học sinh mở link QR...", tên bước | Góc trái trên video | `e2e/flows/video.ts` `show.test`; `test.step` ở flow 4, flow 5 | Flow 4, flow 5 |
| "HS-VPBANK-01", "HS-TPBANK-01" | Mã giới thiệu ở B3. Không có ZZE2E nhưng là mã giả | `scripts/e2e-seed.ts` dòng 33 | Flow 4 |
| "Ngô Thị Hậu Kiểm - 12C2" | Tiêu đề màn kết quả. Không có tiền tố nhưng là tên test | `e2e/flows/05-hau-kiem.spec.ts` dòng 3 | Flow 5 |
| "ZZE2E HSB ..." (trường, ngân hàng), "HSB-P1-01" (mã) | Chưa vào video nào. Video HS-3, HS-5 dùng lại dữ liệu này thì lộ, kèm tên trường có `<script>` và chuỗi 60 ký tự liền | `scripts/e2e-data-student.ts` `HSB`, `NAME`; `scripts/e2e-seed-student.ts` | Chưa có |
| Ảnh `public/brand/photo.jpg` | Ảnh mẫu, ảnh đã nộp ở B3 | `scripts/e2e-seed.ts` dòng 14; `e2e/flows/support.ts` `PHOTO` | Flow 4 |

Phần hậu kiểm của flow 5 (cùng video, khác người xem) còn lộ: khung chương "E2E Kiểm hai ngân hàng quản VPBank và TPBank" (`e2e/flows/05-hau-kiem.spec.ts` dòng 16),
tên tài khoản "E2E Kiểm hai ngân hàng" và tên đăng nhập `zz_e2e_kiem` (`scripts/e2e-seed.ts` dòng 60), tên ngân hàng "ZZE2E HS VPBank" ở Trang 4,
mã voucher "ZZE2ETHPTHS-NTHK-12C2-xxxx" ở khối SMS và Trang 12 (sinh từ tên trường qua `abbreviate` ở `src/server/voucher.ts`).
Trường "ZZDEMO" là dữ liệu thật của DB local. Web học sinh chỉ hiện trường của link, nên chữ này không lên màn học sinh.
