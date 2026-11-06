# E2E ca biên: web học sinh (nhóm A)

Phạm vi: trang `/t/[id]` và `/` ở tên miền học sinh `http://bank.localhost:3100`, API `src/app/api/customers/**`, `src/app/api/schools/[id]`.
Brief chung ở `docs/plans/2026-11-06-e2e-ca-bien.md`. Mọi ca e2e chạy ở khổ 390x844 (loại 14), trừ ca ghi rõ khổ khác.

## Dữ liệu test

- Dữ liệu riêng của nhóm A nằm ở `scripts/e2e-seed-student.ts`, tên trường, ngân hàng, mã đều bắt đầu bằng `ZZE2E HSB `.
- Mỗi file test dựng dữ liệu ở `beforeAll` và dọn ở `afterAll`. Lý do: tên rất dài không dấu cách của nhóm A không được lọt vào các trang quản lý khi `e2e/mobile.spec.ts` đo cuộn ngang. `scripts/e2e-clean.ts` vẫn dọn được vì cùng tiền tố `ZZE2E `.
- Hồ sơ học sinh tạo qua API thật hoặc qua form. Trạng thái không có API cho học sinh (giờ gửi, voucher, kết quả hậu kiểm, đóng trường, thêm bớt khung ảnh) ghi bằng lệnh của `scripts/e2e-seed-student.ts`.

## Danh sách ca

### A. Mở link, chọn trường, quét QR

| Ca | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|
| A1 | Máy mới mở `/t/<uuid không có>` | Màn "Chưa có trường", URL về `/` |
| A2 | Máy đã có trường X mở `/t/abc` | Giữ trường X, hiện B1 của X |
| A3 | Máy mới mở `/t/<id trường đã đóng>` | Màn "Trường đã đóng" kèm tên trường |
| A4 | Máy có hồ sơ ở trường A mở link trường B | Màn "Đổi trường" nêu tên hai trường. "Giữ trường cũ" về hồ sơ A. Mở lại, "Đổi trường" vào B1 của B |
| A5 | Tên trường dài có chuỗi 60 ký tự không dấu cách, có `<script>`, `"`, `'`, `&`, emoji | Ở B1, "Đổi trường", "Trường đã đóng": chữ đúng nguyên văn, không có hộp alert, trang không cuộn ngang |
| A6 | Máy giữ token của hồ sơ không còn | Web quên token, hiện B1 của trường đang lưu |
| A7 | Máy giữ id trường hỏng (không phải uuid) | Màn "Chưa có trường" |
| A8 | `GET /api/customers/me` trả 502 HTML (máy chủ đang khởi động lại) | Màn "Không tải được" với câu mạng, không ghi "Không lưu được". Thử lại khi máy chủ đã trả lời thì vào đúng bước |
| A9 | Mất mạng lúc mở web | Màn "Không tải được", câu "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." |
| A10 | `/t/<id>/thua`, `/abc`, `/admin` ở tên miền học sinh | 404, không 500 |
| A11 | Đang ở B2 bấm Quay lại của trình duyệt rồi bấm Tới | Web hiện lại B2, không mất bước |
| A12 | Tải lại trang ở B1 đang gõ dở, ở B2 đã chọn 1 ngân hàng, ở B3 đã có ảnh | B1 trống, đúng trường. B2 chưa chọn ngân hàng nào. B3 giữ ảnh đã nộp |
| A13 | Hai tab cùng máy ở B3. Tab 2 gửi kiểm tra. Tab 1 bấm Gửi kiểm tra | Tab 1 báo lỗi rồi tải lại, sang màn kết quả |
| A14 | Máy không có camera, bấm "Quét mã QR" | Hộp thoại báo "Không mở được camera. Quét mã QR bằng camera của điện thoại." Đóng thì hết hộp thoại |
| A15 | Camera thấy QR link trường dạng tên miền thật `https://bank.minhgroup-i.com.vn/t/<id>` | Vào B1 của trường đó |
| A16 | Camera thấy QR không phải link trường | Câu "Mã QR này không phải của trường.", không chuyển màn |

### B. B1 khai thông tin

| Ca | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|
| B1 | Bỏ trống mọi ô, rời từng ô | Nút Tiếp tục khoá, lỗi hiện dưới đúng ô |
| B2 | Họ tên chỉ có khoảng trắng | "Nhập họ và tên" |
| B3 | Họ tên đúng 100 ký tự, rồi 101 ký tự | 100 qua. 101 báo "Tối đa 100 ký tự", nút khoá |
| B4 | Họ tên có khoảng trắng đầu cuối, nhiều khoảng trắng liền | Màn kết quả hiện tên đã gọn |
| B5 | Họ tên `<img src=x onerror=alert(1)>`, `'`, `"`, `\`, `%`, `_`, emoji, `'; DROP TABLE customers;--` | Lưu được, màn kết quả hiện đúng nguyên văn dạng chữ, không có alert |
| B6 | Lớp "11 a3", lớp 21 ký tự | "11A3". 21 ký tự báo "Tối đa 20 ký tự" |
| B7 | SĐT 9 số, 11 số, `1912345678`, `+84912345678`, `0912-345-678`, chữ | "SĐT phải có 10 số, bắt đầu bằng 0." |
| B8 | SĐT `0912.345.678` | Qua |
| B9 | SĐT phụ huynh `0912.345.678`, SĐT học sinh `0912 345 678` | "SĐT phụ huynh phải khác SĐT học sinh." |
| B10 | Nhấn Enter ở ô cuối. Nhấn Enter hai lần liền. Bấm đúp Tiếp tục | Gửi bằng Enter được. Chỉ một request tạo hồ sơ |
| B11 | Mất mạng lúc bấm Tiếp tục | Báo "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.", nút bật lại, gửi lại được |
| B12 | Trường đóng sau khi mở form, bấm Tiếp tục | Báo "Trường đã đóng.", không tạo hồ sơ |
| B13 | Ngân hàng đã có: tên dài có và không có dấu cách | Ô tick không đè nhau, trang không cuộn ngang |
| B14 | Trường chưa có ngân hàng nào | Không có khối "Ngân hàng đã có tài khoản". Gửi xong thấy "Ngân hàng đã hết lượt trong tháng này" |
| B15 | Tick đủ mọi ngân hàng của trường | Màn "Không có ngân hàng nào phù hợp" |

### C. B2 chọn ngân hàng

| Ca | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|
| C1 | Chọn 2 rồi bấm ngân hàng thứ 3, bỏ chọn 1 | Ngân hàng thứ 3 khoá, bỏ chọn thì mở lại |
| C2 | Còn 1 ngân hàng (ngân hàng kia hết lượt) | Chọn sẵn, tiêu đề "Chọn ngân hàng", câu "Chỉ còn 1 ngân hàng chưa có tài khoản." |
| C3 | Hết lượt cả hai ngân hàng | "Ngân hàng đã hết lượt trong tháng này" |
| C4 | Đang xem 2 ngân hàng, học sinh khác lấy lượt cuối của một ngân hàng, bấm Tiếp tục | Báo "Ngân hàng vừa hết lượt. Chọn lại.", danh sách tải lại còn 1 ngân hàng chọn sẵn |
| C5 | Đang xem 1 ngân hàng chọn sẵn, lượt được trả lại nên còn 2, bấm Tiếp tục | Web tải lại danh sách 2 ngân hàng để chọn, không kẹt ở câu lỗi |
| C6 | Tên ngân hàng dài có và không có dấu cách | Nút không tràn, dấu tích nằm trong nút, trang không cuộn ngang |
| C7 | Bấm đúp Tiếp tục | Giữ chỗ một lần, vào B3, không có câu lỗi |

### D. B3 mở tài khoản

| Ca | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|
| D1 | Tab tên dài có và không có dấu cách | Trang không cuộn ngang, bấm được cả hai tab, thanh tab dính đầu màn khi cuộn |
| D2 | Bước hướng dẫn dài, có link dài không dấu cách, có `<b>` và `"` | Chữ đúng nguyên văn, xuống dòng, không cuộn ngang |
| D3 | Mã giới thiệu 55 ký tự liền | Mã xuống dòng, nút Sao chép nằm trong khung |
| D4 | Sao chép khi trình duyệt cho ghi clipboard | "Đã sao chép", clipboard có đúng mã |
| D5 | Sao chép khi trình duyệt không có clipboard (trình duyệt trong app Zalo, trang http) | Không báo "Đã sao chép". Báo "Không sao chép được" như nút chép của mgst-app |
| D6 | Link "Quét QR code" có dấu cách. Ngân hàng không có link | `href` đã mã hoá dấu cách, mở tab mới. Không có link thì không có nút |
| D7 | Khung không có ảnh mẫu. Bấm ảnh mẫu khung có tên dài | "Chưa có ảnh mẫu". Hộp xem ảnh mở đúng ảnh, chú thích không tràn ngang |
| D8 | Ngân hàng chưa cài Hướng dẫn (không bước, không khung ảnh) | Tab chỉ có mã, ghi đủ ảnh. Gửi kiểm tra được khi ngân hàng kia đủ ảnh |
| D9 | Quay lại chọn ngân hàng khi chưa có ảnh. Khi đã có ảnh thì bấm Huỷ ở hộp hỏi | Chưa có ảnh: về B2 không hỏi. Có ảnh: Huỷ giữ nguyên ảnh |
| D10 | Trường đóng lúc học sinh ở B3 | Sau khi web tải lại: nút Quay lại ẩn, vẫn nộp ảnh và gửi kiểm tra được |
| D11 | Gửi kiểm tra: còn khung trống, rồi bấm đúp khi đủ ảnh | Nút khoá khi còn khung trống. Bấm đúp chỉ gửi một lần, vào màn kết quả |
| D12 | Người quản lý thêm khung ảnh trong lúc học sinh đủ ảnh ở B3, học sinh bấm Gửi kiểm tra | Báo "Còn khung chưa có ảnh.", web tải lại và hiện khung mới |
| D13 | Người quản lý bỏ một khung trống lúc học sinh ở B3, học sinh nộp ảnh vào khung đó | Báo "Không tìm thấy khung ảnh.", web tải lại, khung biến mất, Gửi kiểm tra bật |

### E. Tải ảnh từng khung

| Ca | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|
| E1 | File văn bản đổi đuôi `.jpg` | "Chỉ nhận ảnh jpg, png, webp hoặc heic.", khung vẫn trống |
| E2 | File `.txt` | "Không mở được ảnh này. Chọn ảnh khác.", không gửi request |
| E3 | File 0 byte tên `anh.jpg` | Báo file rỗng như mgst-app ("File rỗng."), không báo "Chọn ảnh." |
| E4 | File HEIC 21 MB trình duyệt không mở được | "Ảnh lớn hơn 20 MB." ngay ở máy, không gửi request |
| E5 | Ảnh HEIC thật 320x240 (Chrome không mở được HEIC) | Gửi bản gốc, máy chủ đổi WebP, khung ghi "Đã gửi" |
| E6 | Ảnh JPEG 6000x8000 | Máy nén còn dưới 300 KB rồi gửi, khung ghi "Đã gửi" |
| E7 | Ảnh PNG 1x1 | Gửi được |
| E8 | Đang tải ảnh ở một khung | Ô chọn ảnh của khung đó khoá, khung khác vẫn tải được, Gửi kiểm tra khoá tới khi xong |
| E9 | API: `Content-Length` quá 22 MB | 413 "Ảnh lớn hơn 20 MB." |
| E10 | API: file 20,5 MB có chữ ký JPEG | 400 "Ảnh lớn hơn 20 MB." |
| E11 | API: PNG vài trăm byte khai 20000x20000 | 201 trong 5 giây, máy chủ giữ bản gốc |
| E12 | API: HEIC 8192x8192 (vượt trần 64 MP) | 201, máy chủ giữ bản gốc |

### F. Màn kết quả

| Ca | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|
| F1 | Họ tên 100 ký tự không dấu cách, lớp 20 ký tự | Tiêu đề xuống dòng, trang không cuộn ngang |
| F2 | Tên ngân hàng dài có và không có dấu cách | Tên xuống dòng, nhãn trạng thái nằm trọn trong khung |
| F3 | Có voucher, link app PVI đã cài | Khối App PVI có QR và nút "Mở app PVI" trỏ đúng link, mở tab mới. Không có chữ "voucher", không có mã voucher |
| F4 | Chưa có voucher | Không có khối App PVI |
| F5 | Gửi lúc 23:30 giờ Việt Nam, máy đặt múi giờ New York | Hiện "Đã gửi 05/11/2026 23:30" |
| F6 | Một ngân hàng Đạt, một Không đạt (tên dài), có voucher | Câu "<tên> không đạt: nhân viên gọi cho phụ huynh để hướng dẫn." xuống dòng trong khung |
| F7 | Tải lại màn kết quả | Giữ nguyên trạng thái, không có nút Gửi kiểm tra |

### G. API học sinh gọi thẳng

| Ca | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|
| G1 | `POST /api/customers` thiếu Origin, Origin của trang khác | 403 |
| G2 | Body không phải JSON, `[]`, `null`, họ tên là số | 400 câu tiếng Việt, không 500 |
| G3 | `schoolId` sai dạng, không có, trường đã đóng | 400, 404, 409 |
| G4 | `existingBankIds` 51 phần tử, id ngân hàng không có | 400 |
| G5 | `GET /api/schools/<không phải uuid>` | 404 |
| G6 | `GET /api/customers/me` Bearer sai dạng, Bearer 43 ký tự lạ | 401 |
| G7 | Giữ chỗ: `bankIds` trùng `[a, a]`, ngân hàng không ở trường, giữ chỗ lần hai | 400, 409, 409 |
| G8 | Gửi kiểm tra khi còn khung trống, gửi lần hai | 400 "Còn khung chưa có ảnh.", 409 |
| G9 | Nộp ảnh vào dòng ngân hàng của học sinh khác, vào khung của ngân hàng khác | 404, không ghi ảnh |

## 14 loại ca

| Loại | Ca |
|---|---|
| 1. Chữ dài | A5, B3, B13, C6, D1, D2, D3, D7, F1, F2, F6 |
| 2. Ký tự đặc biệt | A5, B5, D2 |
| 3. Tìm kiếm | Không áp dụng: web học sinh không có ô tìm |
| 4. Bộ lọc và URL | A1, A2, A7, A10, G5. Web học sinh không có bộ lọc, tham số URL duy nhất là id trường |
| 5. Phân trang | Không áp dụng: web học sinh không có danh sách phân trang |
| 6. Ngày giờ | F5 |
| 7. Form | B1 tới B12, C7, D11 |
| 8. Phân quyền | A6, G1, G6, G9. Học sinh không có vai trò hay quyền, chỉ có token |
| 9. Đồng thời và trạng thái cũ | A13, C4, C5, D10, D12, D13 |
| 10. Rỗng | B14, B15, C3, D7, D8, F4 |
| 11. Xuất Excel | Không áp dụng: web học sinh không xuất Excel |
| 12. Link | D6, F3. Web học sinh không có ô nhập link; link đến từ Kho mã và Cài đặt, nhóm C kiểm form chặn `javascript:` |
| 13. Tải ảnh | E1 tới E12. Mất mạng giữa chừng và tải lại cùng khung đã có ở `e2e/student.spec.ts` |
| 14. Điện thoại | Mọi ca chạy ở 390x844 |

Ngày sinh biên và CCCD sai dạng: không áp dụng. B1 không thu ngày sinh, không thu CCCD (quyết định 2026-11-05 ở `../du-an-mo-tai-khoan-hoc-sinh/cau-hoi-kien-truc-2026-11-03.md`, mục B4).

## Kết quả

Agent nhóm A làm ngày 2026-11-06, commit f3fece6 tới commit ghi mục này, trên nhánh `dev`.

### Test đã viết

Agent viết 59 test e2e cho 79 ca ở trên, cộng 1 test DB. Mọi ca trong bảng đều có test; một test có thể phủ nhiều ca.

| Màn | File | Số test |
|---|---|---|
| A. Mở link, chọn trường | `e2e/edge-student.spec.ts`, `e2e/edge-student-qr.spec.ts`, `e2e/edge-student-qr-la.spec.ts` | 15 |
| B. B1 khai thông tin | `e2e/edge-student.spec.ts` | 9 |
| C. B2 chọn ngân hàng | `e2e/edge-student-banks.spec.ts` | 6 |
| D. B3 mở tài khoản | `e2e/edge-student-banks.spec.ts` | 9 |
| E. Tải ảnh | `e2e/edge-student-photos.spec.ts`, `e2e/edge-student-api.spec.ts` | 9 |
| F. Màn kết quả | `e2e/edge-student-result.spec.ts` | 2 |
| G. API học sinh | `e2e/edge-student-api.spec.ts` | 9 |
| File 0 byte ở route nộp ảnh | `tests/db/studentRoutes.test.ts` | 1 test DB |

- Dữ liệu: `scripts/e2e-seed-student.ts` dựng 8 trường, 9 ngân hàng, 11 khung ảnh, 9 mã, tên bắt đầu bằng `ZZE2E HSB `. Lệnh `seed`, `clean` và các lệnh đổi trạng thái chỉ nhận id của trường, hồ sơ, khung, mã mang tiền tố đó.
- Quét QR dùng camera giả của Chromium phát file y4m dựng từ chuỗi QR (`qrCamera` ở `e2e/edge-student-support.ts`).
- Kiểm đột biến: bỏ `wrap-anywhere` thì màn kết quả cuộn ngang 1128 px, cả hai test màn kết quả fail. Mọi lỗi dưới đây đều thấy test fail trước khi sửa.

### Lỗi tìm ra và đã sửa

| Ca | Lỗi, góc nhìn học sinh | Commit |
|---|---|---|
| A5, B13, C6, D1, D2, D7, F1, F2 | Tên trường, ngân hàng, khung ảnh, họ tên dài không dấu cách đẩy trang cuộn ngang 599 tới 1128 px ở khổ 390 px; nút Sao chép bị mã giới thiệu đè, bấm không được | c8b2f8c |
| A8 | Máy chủ trả 502 lúc mở web (đang khởi động lại) thì màn ghi "Không lưu được. Thử lại sau ít phút." dù học sinh chưa lưu gì | 4c9e517 |
| A13, D12 | Gửi kiểm tra bị máy chủ từ chối vì hồ sơ đã đổi thì web đứng ở câu lỗi. Tab khác đã gửi: không sang màn kết quả. Người quản lý vừa thêm khung: khung mới không hiện, bấm mãi không qua | 8eb419b |
| D13 | Nộp ảnh vào khung người quản lý vừa bỏ thì khung đứng lại với câu "Không tìm thấy khung ảnh.", Gửi kiểm tra khoá tới khi tải lại trang | 1c7b125 |
| E3 | File 0 byte báo "Chọn ảnh." dù học sinh đã chọn file. Nay báo "File rỗng." như mgst-app | d60471a |
| D5 | Trình duyệt không có clipboard (trong app Zalo, trang http) mà nút vẫn ghi "Đã sao chép". Nay báo "Không sao chép được", chép cách của `CopyButton` ở mgst-app | 97cf8d9 |
| C5 | Đang thấy 1 ngân hàng chọn sẵn, lượt được trả lại nên còn 2: bấm Tiếp tục thì kẹt ở câu "Chọn đúng 2 ngân hàng." với danh sách 1 ngân hàng. Nay web tải lại danh sách 2 ngân hàng (việc để lại của giai đoạn 4) | 3a72ae2 |

Commit 54b53a2 và ca9e711 là test, dữ liệu và sửa test.

### Ruling

- Ruling: dữ liệu nhóm A dựng ở `beforeAll`, dọn ở `afterAll` của từng file, không gắn vào `scripts/e2e-seed.ts`. Tên dài không dấu cách của nhóm A không được có mặt khi `e2e/mobile.spec.ts` đo cuộn ngang các trang quản lý. `scripts/e2e-clean.ts` vẫn dọn được vì cùng tiền tố `ZZE2E `.
- Ruling: chữ dài sửa một chỗ, `wrap-anywhere` ở khung gốc `src/app/student/layout.tsx`, thay vì sửa từng thẻ. Chữ chỉ ngắt giữa từ khi một từ không vừa dòng; tên có dấu cách vẫn ngắt ở dấu cách.
- Ruling: câu lỗi chép mgst-app là "Không chép được, bấm chọn rồi copy tay". mgi-bank ghi "Không sao chép được": web dùng chữ "Sao chép", và luật chữ cấm câu giải thích. Mã giới thiệu vẫn là chữ chọn được để chép tay.
- Ruling: Gửi kiểm tra bị máy chủ trả 400 hoặc 409 thì web tải lại hồ sơ rồi mới hiện câu lỗi. Nộp ảnh bị trả 404 hoặc 409 thì web tải lại hồ sơ. B2 bị trả lỗi ở ô `bankIds` thì web tải lại danh sách như lỗi 409 cũ.
- Ruling cần chủ dự án quyết: trường chưa có ngân hàng nào (B14) vẫn cho khai B1, rồi hiện "Ngân hàng đã hết lượt trong tháng này". Agent giữ theo ruling giai đoạn 4 (hồ sơ giữ `new`). Câu "hết lượt" sai nghĩa với trường chưa có ngân hàng; chủ dự án chọn chặn B1, đổi câu hay giữ.
- Ruling cần chủ dự án quyết: ngân hàng chưa cài Hướng dẫn (D8) không có khung ảnh nào, nên học sinh gửi kiểm tra ngân hàng đó không cần ảnh. Agent giữ nguyên vì luật B2 đã chốt không xét khung ảnh. Chủ dự án chọn loại ngân hàng 0 khung khỏi B2 hay giữ.
- Trường đóng sau khi học sinh mở B1 (B12): web báo "Trường đã đóng." dưới form, không chuyển sang màn Trường đã đóng. Agent giữ, vì học sinh không gửi được gì thêm.

### Chờ

Không có. Agent không sửa file dùng chung nào (`src/components/ui/*`, `src/lib/*`, `src/server/*`, `scripts/e2e-seed.ts`, `scripts/e2e-clean.ts`, `e2e/flows/support.ts`).

### Ca chưa test được

| Ca | Lý do |
|---|---|
| Link `/t/<id viết hoa>` khi máy đã có hồ sơ ở đúng trường đó: đọc code thấy web hỏi "Đổi trường" giữa hai tên giống nhau (`decideLink` so chuỗi phân biệt hoa thường) | Không test, không sửa: QR do app sinh luôn viết thường, đường `/T/` viết hoa thì Next trả 404. Chủ dự án quyết nếu cần |
| Safari trên iPhone: mở HEIC trên máy, nén ảnh, Safari cũ không xuất WebP | Playwright của dự án chỉ chạy Chromium |
| Nginx: 413 dạng HTML khi body quá 22 MB, giới hạn request theo IP | Dev server không có Nginx; route 413 của app đã test (E9) |
| Link xem ảnh hết hạn sau 1 giờ khi học sinh ở lâu ở B3 | Phải chờ 1 giờ; web ký lại link mỗi lần học sinh quay lại tab |
| Nhiều HEIC lớn gửi cùng lúc làm app hết RAM | Cần đo tải thật, ngoài phạm vi e2e |
| Camera thật quét QR mờ, thiếu sáng | Camera giả chỉ phát khung QR rõ nét |
| Trình duyệt trong app Zalo thật | Giả lập bằng cách bỏ `navigator.clipboard` (D5) |
| Mất mạng giữa lúc tải ảnh, tải lại cùng khung | Đã có ở `e2e/student.spec.ts`, không viết lại |

### Kết quả các lệnh

Lần chạy cuối, ngày 2026-11-06. Working tree lúc chạy có việc đang làm dở của nhóm B và nhóm C.

| Lệnh | Kết quả |
|---|---|
| `bun run test` | 232 pass, 0 fail |
| `bun test:db` trên DB tạm `zz_test_edge_a` (đã xoá) | 246 pass, 0 fail |
| `bun run e2e` toàn bộ, dưới khoá, từ commit fab450a | 172 pass, 7 fail. 6 fail nằm ở `edge-business*` và `edge-config*`, là test của nhóm B và C đang viết. 1 fail là A12 |
| A12 chạy lại riêng, dưới khoá, 3 lần | 3 pass |
| `bunx tsc --noEmit` | Sạch |
| `bun run lint` | 0 lỗi, 3 cảnh báo `<img>`: 2 cảnh báo cũ, 1 cảnh báo ở `e2e/edge-config-users.spec.ts` của nhóm C |

A12 fail ở lượt toàn bộ vì dev server chậm. Lệnh tải lại `/` mất 3,6 giây, rồi `/api/customers/me` chưa trả lời sau 5 giây. Lúc đó nhóm khác đang sửa file nguồn, nên dev server biên dịch lại. Chạy riêng thì A12 qua cả 3 lần, nên agent không sửa test.
