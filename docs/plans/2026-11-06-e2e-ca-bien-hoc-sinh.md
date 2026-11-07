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
| A8 | `GET /api/customers/me` trả 502 HTML (máy chủ đang khởi động lại) | Màn "Không tải được" với câu "Thử lại sau ít phút.", không bảo kiểm tra mạng, không ghi "Không lưu được". Thử lại khi máy chủ đã trả lời thì vào đúng bước |
| A9 | Mất mạng lúc mở web | Màn "Không tải được", câu "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." |
| A10 | `/t/<id>/thua`, `/abc`, `/admin` ở tên miền học sinh | 404, không 500 |
| A11 | Đang ở B2 bấm Quay lại của trình duyệt rồi bấm Tới | Web hiện lại B2, không mất bước |
| A12 | Tải lại trang ở B1 đang gõ dở, ở B2 đã chọn 1 ngân hàng, ở B3 đã có ảnh | B1 trống, đúng trường. B2 chưa chọn ngân hàng nào. B3 giữ ảnh đã nộp |
| A13 | Hai tab cùng máy ở B3. Tab 2 gửi kiểm tra. Tab 1 bấm Gửi kiểm tra | Tab 1 báo lỗi rồi tải lại, sang màn kết quả |
| A14 | Máy không có camera, bấm "Quét mã QR" | Hộp thoại báo "Không mở được camera. Quét mã QR bằng camera của điện thoại." Đóng thì hết hộp thoại |
| A15 | Camera thấy QR link trường dạng tên miền thật `https://bank.minhgroup-i.com.vn/t/<id>` | Vào B1 của trường đó |
| A16 | Camera thấy QR không phải link trường | Câu "Mã QR này không phải của trường.", không chuyển màn |
| A17 | Máy mới mở `/t/<id>` lúc mạng lỗi, bấm Thử lại. Máy có hồ sơ ở trường A mở link trường B lúc mạng lỗi, bấm Thử lại | Vào B1 của trường trong link. Máy có hồ sơ thì thấy màn "Đổi trường" |
| A18 | Quét QR trường lúc mạng lỗi, bấm Thử lại | Vào B1 của trường vừa quét |
| A19 | Mạng vẫn lỗi, bấm Thử lại, bấm thêm lần nữa trong lúc chờ | Nút ghi "Đang thử lại" và không gửi thêm request. Lỗi thì nút về "Thử lại", tiêu điểm vẫn ở nút |

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
| B16 | Mọi ngân hàng của trường hết lượt trong tháng | Khối tick có đủ ngân hàng của trường. Tick đủ thì thấy "Không có ngân hàng nào phù hợp" |
| B17 | Ô tick cạnh tên ngân hàng rất dài có và không có dấu cách, cạnh tên ngắn | Ô tick giữ 18x18 px |

### C. B2 chọn ngân hàng

| Ca | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|
| C1 | Chọn 2 rồi bấm ngân hàng thứ 3, bỏ chọn 1 | Ngân hàng thứ 3 khoá, bỏ chọn thì mở lại |
| C2 | Còn 1 ngân hàng (ngân hàng kia hết lượt) | Chọn sẵn, tiêu đề "Chọn ngân hàng", câu "Chỉ còn 1 ngân hàng chưa có tài khoản." |
| C3 | Hết lượt cả hai ngân hàng | "Ngân hàng đã hết lượt trong tháng này" |
| C4 | Đang xem 2 ngân hàng, học sinh khác lấy lượt cuối của một ngân hàng, bấm Tiếp tục | Báo "Ngân hàng vừa hết lượt. Chọn lại.", danh sách tải lại còn 1 ngân hàng chọn sẵn |
| C5 | Đang xem 1 ngân hàng chọn sẵn, lượt được trả lại nên còn 2, bấm Tiếp tục | Web tải lại danh sách 2 ngân hàng để chọn, không kẹt ở câu lỗi. Câu "Chọn đúng 2 ngân hàng." chỉ hiện một lần |
| C6 | Tên ngân hàng dài có và không có dấu cách | Nút không tràn, dấu tích nằm trong nút, trang không cuộn ngang |
| C7 | Bấm đúp Tiếp tục | Giữ chỗ một lần, vào B3, không có câu lỗi |
| C8 | Trường đóng lúc học sinh ở B2, bấm Tiếp tục | Màn "Trường đã đóng", không giữ chỗ |
| C9 | Hai tab ở B2. Tab kia giữ chỗ trước, tab này chọn ngân hàng khác rồi bấm Tiếp tục | Tab này sang B3 với ngân hàng tab kia đã chọn |

### D. B3 mở tài khoản

| Ca | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|
| D1 | Tab tên dài có và không có dấu cách | Trang không cuộn ngang, bấm được cả hai tab, thanh tab dính đầu màn khi cuộn |
| D2 | Bước hướng dẫn dài, có link dài không dấu cách, có `<b>` và `"` | Chữ đúng nguyên văn, xuống dòng, không cuộn ngang |
| D3 | Mã giới thiệu 55 ký tự liền | Mã xuống dòng, nút Sao chép nằm trong khung |
| D4 | Sao chép khi trình duyệt cho ghi clipboard | "Đã sao chép" ở vùng `aria-live`, clipboard có đúng mã, 2 giây sau câu báo mất. Vùng báo rỗng không thêm hàng trống |
| D5 | Sao chép khi trình duyệt không có clipboard (trình duyệt trong app Zalo, trang http) | Không báo "Đã sao chép". Báo "Không sao chép được" như nút chép của mgst-app, 2 giây sau câu báo mất. Mã có `user-select: all` để một cú bấm chọn hết mã |
| D6 | Link "Quét QR code" có dấu cách. Ngân hàng không có link | `href` đã mã hoá dấu cách, mở tab mới. Không có link thì không có nút |
| D7 | Khung không có ảnh mẫu. Bấm ảnh mẫu khung có tên dài | "Chưa có ảnh mẫu". Hộp xem ảnh mở đúng ảnh, chú thích không tràn ngang |
| D8 | Ngân hàng chưa cài Hướng dẫn (không bước, không khung ảnh) | Tab chỉ có mã, ghi đủ ảnh. Gửi kiểm tra được khi ngân hàng kia đủ ảnh |
| D9 | Quay lại chọn ngân hàng khi chưa có ảnh. Khi đã có ảnh thì bấm Huỷ ở hộp hỏi | Chưa có ảnh: về B2 không hỏi. Có ảnh: Huỷ giữ nguyên ảnh |
| D10 | Trường đóng lúc học sinh ở B3 | Sau khi web tải lại: nút Quay lại ẩn, vẫn nộp ảnh và gửi kiểm tra được |
| D11 | Gửi kiểm tra: còn khung trống, rồi bấm đúp khi đủ ảnh | Nút khoá khi còn khung trống. Bấm đúp chỉ gửi một lần, vào màn kết quả |
| D12 | Người quản lý thêm khung ảnh trong lúc học sinh đủ ảnh ở B3, học sinh bấm Gửi kiểm tra | Báo "Còn khung chưa có ảnh.", web tải lại và hiện khung mới. Nộp ảnh vào khung mới thì câu lỗi mất |
| D13 | Người quản lý bỏ một khung trống lúc học sinh ở B3, học sinh nộp ảnh vào khung đó | Báo "Không tìm thấy khung ảnh.", web tải lại, khung biến mất, Gửi kiểm tra bật |
| D14 | Trường vừa đóng mà web chưa tải lại, học sinh bấm Quay lại chọn ngân hàng: chưa có ảnh, rồi đã có ảnh | Web tải lại, nút Quay lại ẩn, câu "Trường đã đóng." hiện dưới tab, hộp hỏi đóng lại, ảnh còn nguyên. Tiêu điểm nằm ở câu lỗi, không rơi về `body` |
| D15 | Hai tab ở B3. Tab 2 gửi kiểm tra. Tab 1 bấm Quay lại chọn ngân hàng | Tab 1 sang màn kết quả |
| D16 | Bấm đúp Quay lại khi chưa có ảnh, mạng chậm | Nút khoá trong lúc chờ, chỉ một request, về B2 |
| D17 | Trang ẩn rồi hiện lại (camera Android) lúc mạng chậm, ảnh nộp xong trước khi lần tải lại cũ về | Ảnh vừa nộp vẫn hiện |
| D18 | Link ảnh mẫu, ảnh đã nộp, ảnh QR trả 403 (link hết hạn) | Khung vẫn ghi "Đã gửi", khung ảnh giữ 160 px, ô QR giữ 96 px, trang không cuộn ngang |
| D19 | Tab tên dài cạnh tab tên ngắn. Hai tab tên dài | Vòng tròn đánh dấu giữ 16x16 px, tên ngắn nằm trên một dòng, trang không cuộn ngang |
| D20 | Có ảnh, bấm Quay lại trong hộp hỏi lúc mạng chậm, rồi bấm Huỷ, X, Esc | Huỷ khoá, X và Esc không đóng hộp. Xong thì về B2 |
| D21 | Hộp hỏi Quay lại báo mất mạng. Bấm Huỷ, có mạng lại, mở hộp lần nữa | Hộp không còn câu lỗi cũ, Quay lại được |
| D22 | Hai tab ở B3. Tab kia bấm Quay lại nên hồ sơ về B2. Tab này nộp ảnh | Web tải lại sang B2, không hiện câu "Hồ sơ đã gửi kiểm tra." |

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
| F6 | Một ngân hàng Đạt, một Không đạt (tên dài), có voucher | Không có câu "nhân viên gọi cho phụ huynh" ở màn kết quả (chủ dự án chốt 2026-11-07). |
| F7 | Tải lại màn kết quả | Giữ nguyên trạng thái, không có nút Gửi kiểm tra |
| F8 | Khối Zalo có link dài ở màn hết lượt, màn không có ngân hàng phù hợp, màn kết quả | QR và chữ nằm trọn trong khối, khối nằm trọn trong khổ 390 px |

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
| 1. Chữ dài | A5, B3, B13, B17, C6, D1, D2, D3, D7, D19, F1, F2, F6, F8 |
| 2. Ký tự đặc biệt | A5, B5, D2 |
| 3. Tìm kiếm | Không áp dụng: web học sinh không có ô tìm |
| 4. Bộ lọc và URL | A1, A2, A7, A10, A17, G5. Web học sinh không có bộ lọc, tham số URL duy nhất là id trường |
| 5. Phân trang | Không áp dụng: web học sinh không có danh sách phân trang |
| 6. Ngày giờ | F5 |
| 7. Form | B1 tới B12, A19, C7, D11, D14, D16, D20, D21 |
| 8. Phân quyền | A6, G1, G6, G9. Học sinh không có vai trò hay quyền, chỉ có token |
| 9. Đồng thời và trạng thái cũ | A13, C4, C5, C8, C9, D10, D12 tới D15, D17, D20, D22 |
| 10. Rỗng | B14, B15, B16, C3, D7, D8, F4 |
| 11. Xuất Excel | Không áp dụng: web học sinh không xuất Excel |
| 12. Link | D6, F3, F8. Web học sinh không có ô nhập link; link đến từ Kho mã và Cài đặt, nhóm C kiểm form chặn `javascript:` |
| 13. Tải ảnh | E1 tới E12, D17, D18. Mất mạng giữa chừng và tải lại cùng khung đã có ở `e2e/student.spec.ts` |
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

## Lượt 2: sửa theo review

Agent nhóm A làm ngày 2026-11-06, commit acc1c8a tới commit ghi mục này, trên nhánh `dev`. Báo cáo review nhóm A tìm ra 3 lỗi Important (I1 tới I3), 8 lỗi Minor (M1 tới M8) và 15 ca sót.

### Test đã thêm

- 12 test e2e mới: A17, A18, B16, B17, C8, D14 tới D19, F8. Nhóm A nay có 71 test e2e.
- Test đã sửa: A8, C5, C6, D1, D4, D5, D12, D13, F2, F3.
- 1 test DB cho `programBanksAtSchool` ở `tests/db/customers.test.ts`.
- Dữ liệu: thêm trường `ZZE2E HSB Trường có tên ngân hàng dài và ngắn`, mã P1 có ảnh QR, lệnh `slot-reset` trả khung ảnh về như lúc seed.
- Lượt chạy đầu trên code cũ: 14 test fail đúng chỗ lỗi, test DB fail vì chưa có hàm. Test cho ca sót 6, 9, 11 và test M1, M7, M8 pass ngay trên code cũ.

### Lỗi đã sửa

| Mã review | Ca | Lỗi, góc nhìn học sinh | Commit |
|---|---|---|---|
| I1 | A17, A18 | Mất mạng lúc mở link hay quét QR trường, bấm Thử lại thì thấy "Chưa có trường". Máy có hồ sơ ở trường khác thì về thẳng hồ sơ cũ, không hỏi đổi trường | acc1c8a |
| I2 | D14, D15, D16 | Trường vừa đóng mà web chưa tải lại: bấm Quay lại thì câu "Trường đã đóng." hiện mà nút vẫn còn; có ảnh thì câu lỗi nằm trong hộp hỏi. Tab khác đã gửi kiểm tra thì màn B3 đứng lại. Bấm đúp khi chưa có ảnh gửi hai request | 4306fe4 |
| I3 | B16 | Ô tick "Ngân hàng đã có tài khoản" thiếu ngân hàng hết lượt. Học sinh có đủ ngân hàng kẹt ở màn hết lượt. Trường mà mọi mã hết lượt thì mất hẳn khối tick | fbc8ae2 |
| Ca sót 8 | D17 | Camera Android làm trang ẩn rồi hiện lại lúc mạng chậm: lần tải lại cũ về muộn làm khung vừa nộp ảnh trở lại trống | 2e3fb27 |
| M1 | F3 | Test F3 pass mà không kiểm khối App PVI khi link app PVI trống | effebf0 |
| M2 | D12 | Nộp ảnh vào khung mới mà câu "Còn khung chưa có ảnh." vẫn hiện tới lần bấm sau | 583235d |
| M3 | D4, D5 | Câu "Đã sao chép" hay "Không sao chép được" ở lại mãi, trình đọc màn hình không được báo, vùng báo rỗng thêm 6 px | d521b31 |
| M4 | B17, D19 | Tên ngân hàng dài bóp vòng tròn ở tab còn 6,7 px thay vì 16 px, ô tick ở B1 còn 13 px thay vì 18 px. Tab tên ngắn cạnh tab tên dài vỡ thành 6 dòng | ec70f2f |
| M5 | C5 | Câu "Chọn đúng 2 ngân hàng." hiện hai lần sau khi web tải lại danh sách | 6e79ca7 |
| M6 | A8 | Máy chủ trả 502, 500 hay 429 lúc mở web mà màn bảo kiểm tra mạng | 6b46b66 |
| M7 | D12, D13 | D13 chạy lần hai thì fail vì khung đã bỏ không được mở lại | a8357f7 |
| M8 | C6, D1, F2 | Test đo phần tử với mép phải màn hình, phần tử tràn khung cha vẫn pass | 4fdcbf8 |

Commit 9bc0980 là test cho ca sót 6, 9, 11 (C8, D18, F8).

Lượt này agent sửa ba file dùng chung, có phép của brief: `src/server/customers.ts` và `src/app/api/schools/[id]/route.ts` cho I3, `src/components/ui/Checkbox.tsx` cho M4. `openBanksAtSchool` giữ nguyên hành vi.

### Ruling mới

- Ruling (M6): mgst-app không có web cho khách. Màn đăng nhập của mgst-app tách hai lỗi: mất mạng thì báo kiểm tra kết nối mạng, máy chủ trả lỗi thì báo thử lại sau ít phút (`../mgst-app/src/lib/api/auth.ts`, `../mgst-app/src/app/login/page.tsx`). Màn "Không tải được" chép cách đó: mất mạng ghi "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.", máy chủ có trả lời mà lỗi ghi "Thử lại sau ít phút.".
- Ruling (M3): nút luôn ghi "Sao chép" và đổi icon khi chép xong. Câu báo nằm cạnh nút trong vùng `aria-live="polite"` như `CopyButton` của mgst-app, tự mất sau 2 giây.
- Ruling (I2): Quay lại bị máy chủ trả 409 thì web tải lại hồ sơ, đóng hộp hỏi, hiện câu lỗi dưới tab. Hộp hỏi chỉ giữ câu lỗi khác 409, ví dụ mất mạng.
- Ruling (M5): B2 bị trả 400 ở ô `bankIds` thì web tải lại danh sách và không nhắc câu lỗi, vì dòng gợi ý đã ghi "Chọn đúng 2 ngân hàng.". Lỗi 409 vẫn hiện câu lỗi.
- Ruling (M4): thanh tab B3 dùng grid thay flex. Grid chia chỗ đều tới khi tab ngắn đủ chỗ cho tên, phần còn lại cho tab dài. Grid có `justify-start` nên không kéo giãn tab, tab tên ngắn rộng bằng chữ như trước. Kiểm đột biến: bỏ grid thì D19 fail. Ô tick ở hộp Thêm tài khoản và hộp Hướng dẫn của trang quản lý đo được 18x18 px cả trước và sau khi thêm `shrink-0`, ở 1366 px và 390 px.
- Ruling (I3): B1 hỏi ngân hàng đã có trên mọi ngân hàng của chương trình ở trường, bỏ qua lượt. Ngân hàng của chương trình là ngân hàng đang mở có mã đang dùng gắn cho trường, cùng tập với `hasAllBanks`.
- Ruling (M1, ca sót 11): test không ghi Cài đặt thật của DB local. F3 kiểm link app PVI mặc định khác rỗng. F8 chèn link Zalo vào hồ sơ trả về bằng `page.route`.
- Ruling (M7): agent chạy bản cũ với D12 trước D13 thì D13 vẫn pass, nên câu "đảo thứ tự thì D13 fail" của review không đúng. Lỗi thật là D13 chạy lần hai thì fail. Nay hai test trả khung trong `finally`.
- Ruling (ca sót 9): đồng ý với review. Link ảnh hết hạn giả được bằng `page.route` trả 403 cho ảnh ngoài tên miền học sinh.

### Ca chưa làm

| Ca sót | Nội dung | Lý do |
|---|---|---|
| 7 | Request treo không trả lời (sóng yếu) lúc mở web hay ở B1: màn "Đang tải" không có nút, nút Tiếp tục ở B1 khoá mãi | `studentApi` không có thời hạn, mgst-app cũng không đặt. Chủ dự án quyết có đặt thời hạn không |
| 10 | Hai tab cùng ở B1 cùng gửi: tạo hai hồ sơ, tab gửi sau ghi đè token | Ưu tiên thấp |
| 14 | Máy có hồ sơ ở trường A mở link trường B đã đóng: web vẫn hỏi đổi trường, đổi xong mất hồ sơ A mà chỉ thấy "Trường đã đóng" | Ưu tiên thấp |
| 15 | Họ tên gõ bằng bộ gõ Unicode tổ hợp (Laban Key) không được chuẩn hoá NFC, mà OCR ở giai đoạn 6 so nguyên văn | Ưu tiên thấp |

B14 và D8 giữ nguyên hành vi, chờ chủ dự án quyết. Khuyến nghị của review:
- B14: giữ luồng, không chặn B1. Nếu muốn câu đúng nghĩa thì chỉ đổi tiêu đề cho ca trường không có mã nào.
- D8: loại ngân hàng không có khung ảnh nào khỏi B2. Việc này thêm điều kiện vào luật B4 đã chốt, nên chủ dự án phải chốt.

### Kết quả các lệnh

Ngày 2026-11-06. Working tree lúc chạy có việc đang làm dở của nhóm B và nhóm C.

| Lệnh | Kết quả |
|---|---|
| `bun run test` | 232 pass, 0 fail |
| `bunx tsc --noEmit` | Sạch |
| `bun run lint` | 0 lỗi, 2 cảnh báo `<img>` cũ |
| `bun test:db` trên DB tạm `zz_test_edge_a` (đã xoá) | 253 pass, 0 fail |
| `bun run e2e e2e/edge-student` trên code cũ với test mới, dưới khoá | 57 pass, 14 fail đúng chỗ lỗi |
| `bun run e2e e2e/edge-student` trên code đã sửa, dưới khoá | 71 pass, 0 fail |
| Kiểm đột biến dưới khoá: bỏ grid ở thanh tab | D19 fail, tên ngắn vỡ thành 6 dòng |

Agent chạy e2e trên code đã sửa trước khi tách thành từng commit. Sau khi tách, agent so từng file với bản đã chạy: giống hệt.

## Lượt 3: sửa theo review lần 2

Agent nhóm A làm ngày 2026-11-06 và 2026-11-07, commit 00c97bc tới commit ghi mục này, trên nhánh `dev`. Review lần 2 tìm ra 1 lỗi Important (N1), 5 lỗi Minor (N2 tới N6) và 7 ca sót.

### Test đã thêm

- 5 test e2e mới: A19, C9, D20, D21, D22. Nhóm A nay có 76 test e2e.
- Test đã sửa: D5 kiểm `user-select: all` của mã giới thiệu. D14 kiểm tiêu điểm ở cả hai nhánh, chưa có ảnh và có ảnh.
- 1 test DB mới ở `tests/db/e2eSeedStudent.test.ts`: lệnh `slot-add` nhận id của khung thật thì phải báo lỗi, khung giữ nguyên.
- Lượt chạy đầu trên code cũ (bd01e42): A19, D5, D14, D20, D21 fail đúng chỗ lỗi. C9 và D22 pass ngay, nên ca sót 3, 4 không cần sửa code. Test DB fail: lệnh thoát mã 0 và đổi tên khung thật.
- Trước khi sửa N5, agent đo bằng trình duyệt: sau 409, `document.activeElement` là `body` ở cả hai nhánh của D14.

### Lỗi đã sửa

| Mã review | Ca | Lỗi, góc nhìn học sinh | Commit |
|---|---|---|---|
| N1 | D20 | Mạng chậm, học sinh bấm Quay lại trong hộp hỏi rồi bấm Huỷ, X hay Esc. Hộp đóng, học sinh tưởng giữ được ảnh, lát sau ảnh vẫn bị xoá và web nhảy về B2. Hộp xác nhận ở trang quản lý có cùng lỗi | 00c97bc |
| N2 | D21 | Hộp hỏi báo mất mạng, học sinh bấm Huỷ. Có mạng lại, mở hộp lần nữa thì câu lỗi cũ vẫn còn | b3cc5ce |
| N3 | D5 | Trong app Zalo nút Sao chép không chép được. Nhấn giữ để chọn mã thì trình duyệt chỉ chọn một đoạn giữa hai dấu `-` | 229ec88 |
| N4 | Test DB | Lệnh `slot-add` của dữ liệu e2e nhận id khung bất kỳ. Truyền id của khung thật thì lệnh đổi tên và mở lại khung đó | 003b031 |
| N5 | D14 | Quay lại bị máy chủ trả 409 thì nút vừa bấm biến mất, tiêu điểm rơi về `body`. Người dùng bàn phím phải Tab lại từ đầu trang | 3d3c32d |
| Ca sót 6 | A19 | Màn "Không tải được": bấm Thử lại khi mạng vẫn lỗi thì màn đứng yên như chưa bấm | 0a684b4 |

Commit 14af9ac là test cho ca sót 3, 4 (C9, D22).

Lượt này agent sửa một file dùng chung: `src/components/users/ConfirmDialog.tsx` (N1). Trang quản lý dùng hộp này ở Trường, Ngân hàng, Kho mã, Tài khoản và hậu kiểm Đạt, Không đạt.

### Ruling mới

- Ruling (N1): `ConfirmDialog` chép `../mgst-app/src/components/ui/ConfirmDialog.tsx`. Lúc request đang chạy, nút Huỷ khoá, X và Esc không đóng hộp. Request xong hay lỗi thì hộp đóng được như cũ. Hộp Đạt, Không đạt ở `e2e/edge-business-detail.spec.ts` bấm Huỷ sau lỗi 409 vẫn đóng.
- Ruling (N2): `OpenAccount` chỉ dựng hộp hỏi lúc mở, như năm chỗ dùng ở trang quản lý. Agent không thêm bước xoá lỗi vào `ConfirmDialog`.
- Ruling (N5): Quay lại bị 409 thì tiêu điểm chuyển tới câu lỗi dưới tab (`tabIndex={-1}`), ở cả hai nhánh có ảnh và chưa có ảnh. Agent không chọn nút Gửi kiểm tra vì nút đó có thể đang khoá.
- Ruling (ca sót 6): chép `ErrorState` của mgst-app (`../mgst-app/src/components/ui/ErrorState.tsx`). Trong lúc chờ, nút ghi "Đang thử lại" và mang `aria-disabled`, bấm thêm không gửi request. `aria-disabled` giữ tiêu điểm ở nút, `disabled` thì gỡ tiêu điểm. Agent không dùng màn "Đang tải" vì màn đó gỡ nút, tiêu điểm rơi về `body`. Máy tắt hẳn mạng thì request lỗi ngay, nên chữ "Đang thử lại" chỉ hiện rất ngắn. mgst-app hiện lâu hơn vì TanStack Query tự thử lại một lần sau 1 giây.
- Ruling (ca sót 3): tab này sang B3 với ngân hàng tab kia đã giữ và không hiện câu 409 "Hồ sơ đã chọn ngân hàng.", như D15. Màn B3 đã hiện đúng ngân hàng đang giữ.
- Ruling (ca sót 4): web tải lại sang B2 nên câu sai nghĩa "Hồ sơ đã gửi kiểm tra." không hiện. Agent không đổi câu của máy chủ.
- N6: giữ nguyên `openBanksAtSchool` theo luật sửa tối thiểu.

### Ca chưa làm

| Ca | Nội dung | Lý do |
|---|---|---|
| Ca sót 7 của review lần 2 | Học sinh ở B2 lúc 23:59, bấm Tiếp tục lúc 00:00 ngày đầu tháng giờ Việt Nam. Máy chủ tính lượt theo tháng mới, danh sách đổi thì web tải lại | Chỉ test được ở tầng DB với tham số `month`. Ưu tiên thấp. Brief của lượt này chỉ yêu cầu ghi lại |
| Esc lần thứ ba | Hộp hỏi đang chạy, học sinh nhấn Esc (hay nút Back của Android) ba lần liền, không bấm gì xen giữa. Chrome đóng thẻ `<dialog>` ở lần thứ ba dù trang chặn `cancel`, request vẫn chạy | Luật chống lạm dụng của trình duyệt. Agent đo bằng test tạm (đã xoá): Esc lần 1 và 2 giữ hộp mở, lần 3 đóng hộp. mgst-app cũng vậy. Agent không sửa |

B14, D8 và thời hạn request (ca sót 7 của review lần 1) giữ nguyên hành vi, chờ chủ dự án quyết.

### Kết quả các lệnh

Ngày 2026-11-06 và 2026-11-07. Working tree lúc chạy có việc đang làm dở của nhóm B và nhóm C.

| Lệnh | Kết quả |
|---|---|
| `bun run test` | 233 pass, 0 fail |
| `bunx tsc --noEmit` | Sạch |
| `bun run lint` | 0 lỗi, 2 cảnh báo `<img>` cũ |
| `bun test:db` trên DB tạm `zz_test_edge_a2` (đã xoá) | 256 pass, 0 fail. DB mới migrate phải chạy `bun db:seed` để có tỉnh, xã |
| Test mới và test đã sửa của nhóm A trên code cũ bd01e42, dưới khoá | 2 pass (C9, D22), 5 fail đúng chỗ lỗi (A19, D5, D14, D20, D21) |
| `bun run e2e e2e/edge-student` trên code đã sửa, dưới khoá | 77 pass, 0 fail: 76 test của nhóm A và 1 test đo tạm Esc (đã xoá) |
| `bun run e2e e2e/edge-config-` trên cùng bản build, dưới khoá | 70 pass, 10 fail. 9 fail ở `e2e/edge-config-zzred.spec.ts`, test đỏ của nhóm C cho lỗi nhóm C chưa đưa vào bản build. 1 fail ở `edge-config-codes.spec.ts:114`: nhóm C commit test và bản sửa ở d8a782d sau khi bản build bắt đầu. Không test nào của hộp xác nhận fail |
| `bun run e2e e2e/edge-business` trên cùng bản build, dưới khoá | 31 pass, 1 fail: ô tìm mã voucher (`edge-business-lists.spec.ts:117`) ra "0 mã". Nhóm B commit test và bản sửa ở 64ddec2 sau khi bản build bắt đầu. Trang Voucher không dùng `ConfirmDialog`. Chạy lại riêng nhóm test voucher trên 14af9ac, dưới khoá: 4 pass |

Bản build cho ba lượt e2e trên code đã sửa bắt đầu lúc 23:52:26 từ 7a571ab cộng các thay đổi của lượt này. 7a571ab chỉ đổi script dọn dữ liệu và test DB so với bd01e42. Lúc đó working tree chỉ có thêm file test chưa commit của agent khác. Trong lúc build và chạy, nhóm B và nhóm C commit thêm từ 7a3b3f3 tới debb57b. Sau khi tách thành từng commit, agent kiểm: bỏ hết các đoạn của bảy commit thì các file đó ra đúng bản ở debb57b, và bản cuối giống hệt bản đã chạy.
