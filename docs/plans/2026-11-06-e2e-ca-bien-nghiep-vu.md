# E2E ca biên nhóm B: nghiệp vụ

Kế hoạch chung ở `docs/plans/2026-11-06-e2e-ca-bien.md`. File này ghi danh sách ca của nhóm B, rồi ghi kết quả.

Phạm vi: Hồ sơ học sinh (`/customers`), chi tiết hồ sơ (`/customers/[id]`), Ngân hàng nhóm Nghiệp vụ (`/customer-banks`), Mã voucher (`/vouchers`), Tin SMS lỗi (`/sms`), xuất Excel của các trang này, API ở `src/app/api/admin/customers/**`, `customer-banks/**`, `photos/[id]`, `vouchers/**`, `sms/**`.

## Dữ liệu test

Seed riêng ở `scripts/e2e-seed-business.ts`, gắn vào `scripts/e2e-seed.ts` bằng một dòng. Mọi trường và ngân hàng mang tiền tố `ZZE2E `, tài khoản mang tiền tố `zz_e2e_`, nên `scripts/e2e-clean.ts` dọn được như dữ liệu e2e cũ.

- Trường B "ZZE2E THPT Biên Nghiệp Vụ ..." (khoảng 95 ký tự, có dấu cách) và trường B2 "ZZE2E THPT Biên Hai".
- Ngân hàng B1 tên khoảng 80 ký tự có dấu cách, B2 tên ngắn, B3 không có hồ sơ nào. Mỗi ngân hàng một khung ảnh, một mã giới thiệu.
- Tài khoản Nhân viên: `zz_e2e_bien1` quản B1, `zz_e2e_bien2` quản B2 và có quyền Xuất Excel, `zz_e2e_bien3` quản B3, `zz_e2e_bien4` quản B2 và B3.
- 16 hồ sơ "Biên Phân Trang 01" tới "16": B1 Đạt, có voucher, có tin SMS lỗi. Hồ sơ 16 có thêm B2 đang chờ kiểm tra.
- Hồ sơ "Biên Giờ Khuya" tạo 23:30 ngày 31/10/2026 giờ Việt Nam, "Biên Giờ Sớm" tạo 00:30 ngày 01/11/2026. Voucher cấp lúc 23:45 và 00:45.
- Hồ sơ tên dài 100 ký tự có dấu cách, hồ sơ tên 100 ký tự liền không dấu cách kèm ghi chú 1.000 ký tự liền.
- Hồ sơ tên có `<script>`, `<img onerror>`, ngoặc kép, ngoặc đơn, `%`, `_`, `\`, emoji, chữ `Ð`, và hồ sơ có tên, lớp, phụ huynh bắt đầu bằng `=`, `+`, `-`, `@`.
- Hồ sơ chỉ có B2, hồ sơ có cả B1 và B2 kèm ảnh ở cả hai, hồ sơ chưa chọn ngân hàng, hai hồ sơ trùng tên và SĐT.
- Các hồ sơ riêng cho từng ca đồng thời (hai tab hậu kiểm, hai tab sửa thông tin, thay ảnh, ghi chú, Gửi lại).
- Hồ sơ riêng cho các ca review lần 1 tìm ra: "Biên Ảnh Cũ", "Biên Đạt Cùng Lúc", "Biên Không Đạt Trước", "Biên Bấm Đúp", "Biên Lỗi Dài" (cột Lỗi 500 ký tự liền), "Biên Bỏ Giao" (B2 chờ kiểm tra, tin SMS lỗi).
- 17 hồ sơ "Biên Chờ Kiểm A" tới "Q" chờ kiểm tra ở B1: 16 hồ sơ ngày 15/10, hồ sơ Q ngày 14/10, nên lọc Chờ kiểm tra theo tên ra đúng 1 dòng ở trang 2. Hồ sơ A có thêm B2.
- Hai hồ sơ có tên, lớp, phụ huynh bắt đầu bằng `=`, `+`, `-`, `@` có voucher, để file Mã voucher có ô bắt đầu bằng ký tự công thức.

Tên hồ sơ không chứa chữ mà test cũ dùng để tìm (`xuat`, `kiem anh`, `ngo thi hau kiem`...). Tên ngân hàng và trường dài có dấu cách, nên trang Ngân hàng và Trường của nhóm C vẫn hiện được. Ca tên liền không dấu cách dùng hồ sơ, không dùng tên ngân hàng hay trường.

## Ca của Trang 3: Hồ sơ học sinh

| Mã | Loại | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|---|
| T3-01 | 1, 14 | Hồ sơ tên 100 ký tự có dấu cách, lớp 20 ký tự, trường 95 ký tự, ngân hàng 80 ký tự; khổ 1366x768 và 390x844 | Cả trang không cuộn ngang, bảng cuộn trong khung, ô tìm, nút Bộ lọc, nút Xuất Excel nằm trọn trong màn hình |
| T3-02 | 1, 14 | Hồ sơ tên 100 ký tự liền không dấu cách | Như T3-01 |
| T3-03 | 2 | Tên có `<script>alert(1)</script>`, `<img src=x onerror=...>`, `"Kép" 'Đơn' 50% a_b \`, emoji, `Ð` | Hiện đúng nguyên văn dạng chữ, không có thẻ `img` hay `script` nào được tạo, không có hộp `alert` |
| T3-04 | 2, 3 | Tìm `%`, `_`, `\`, `'`, `"` | Chỉ ra hồ sơ có đúng ký tự đó, không coi `%` `_` là ký tự đại diện |
| T3-05 | 2, 4 | URL `q=%00`, `q=a%00b`, `q=' or 1=1 --` | Trang hiện bình thường, không lỗi 500, ký tự NUL bị bỏ |
| T3-06 | 3 | Tìm "Biên Phân Trang", "bien phan trang", "BIÊN PHÂN", "phan tra" | Đều ra đủ 16 hồ sơ |
| T3-07 | 3 | Tìm nhiều từ khác thứ tự hoặc bỏ từ giữa: "trang 07 bien", "bien 07" | Ra "Biên Phân Trang 07", như ô tìm của mgst-app |
| T3-08 | 3 | Tìm SĐT phụ huynh có dấu cách, dấu chấm, một phần số | Ra đúng hồ sơ |
| T3-09 | 3 | Ô tìm chỉ có khoảng trắng | Như không tìm: hiện mọi hồ sơ, không báo rỗng |
| T3-10 | 3 | Dán 20.000 ký tự vào ô tìm rồi Enter; gõ URL `q` dài 2.000 ký tự | Ô tìm nhận tối đa 100 ký tự như mgst-app, trang không lỗi 431; URL dài hiện câu báo rỗng, không lỗi 500 |
| T3-11 | 3, 5 | Đang ở trang 2, đổi từ khoá | Về trang 1, giữ bộ lọc đang bật |
| T3-12 | 3, 10 | Tìm không khớp | "Không có hồ sơ khớp bộ lọc." |
| T3-13 | 4 | Kết hợp tìm, Trạng thái, Số ngân hàng đạt và trang 2 | Tổng đầu bảng khớp; đổi một bộ lọc thì về trang 1 |
| T3-14 | 4 | `page=0`, `-1`, `abc`, `999`, `1e400`, `2.5` | Trang 1 hoặc trang cuối, không lỗi 500 |
| T3-15 | 4 | `status=foo`, `passed=3`, `check=x` | Bỏ qua giá trị lạ, không có chip, bảng như không lọc |
| T3-16 | 4, 6 | `from=2026-02-30`, `from=abc`, `from=0001-01-01`, `to=0000-01-01` | Bỏ qua ngày sai, không lỗi 500 |
| T3-17 | 4 | Bỏ chip Trạng thái khi đang lọc cả Trạng thái, Ngày, Số ngân hàng đạt và tìm | Chỉ mất Trạng thái, các lọc khác và từ khoá giữ nguyên |
| T3-18 | 4 | Lọc Trạng thái rồi Số ngân hàng đạt, bấm Quay lại của trình duyệt | URL, chip, ô chọn trong bảng Bộ lọc về đúng bước trước |
| T3-19 | 5 | 16 hồ sơ | Trang 1 đúng 15 dòng, ghi "1–15 trên 16", có nút Sau; trang 2 một dòng, "16–16 trên 16" |
| T3-20 | 5 | Lọc còn đúng 15 hồ sơ | "1 / 1", không có nút Sau |
| T3-21 | 5, 9 | Chuyển sang SMS-10: Trang 3 và Tin SMS lỗi dùng chung cách kẹp trang về trang cuối, trang SMS có nút làm dòng biến mất ngay trên trang | Xem SMS-10 |
| T3-22 | 6 | Hồ sơ tạo 23:30 ngày 31/10 và 00:30 ngày 01/11 giờ Việt Nam | Cột Ngày ghi "31/10 23:30" và "01/11 00:30"; 00:30 đứng trên |
| T3-23 | 6 | Lọc từ ngày bằng tới ngày 31/10/2026, rồi 01/11/2026 | Lấy trọn ngày giờ Việt Nam: ngày 31/10 ra hồ sơ 23:30, ngày 01/11 ra hồ sơ 00:30 |
| T3-24 | 6 | URL từ ngày lớn hơn tới ngày | Bảng rỗng, chip ghi đúng hai ngày, không lỗi; ô ngày trong bảng Bộ lọc chặn chọn ngược bằng `min`, `max` |
| T3-25 | 8 | Nhân viên quản B1 xem danh sách, tìm đúng tên hồ sơ chỉ có B2, gọi `GET /api/admin/customers?q=` | Chỉ thấy hồ sơ có B1; hồ sơ chỉ có B2 và hồ sơ chưa chọn ngân hàng không hiện ở trang lẫn API |
| T3-26 | 8 | Nhân viên không có quyền Xuất Excel | Không thấy nút Xuất Excel, gọi route xuất nhận 403 |
| T3-27 | 8 | Tài khoản không quyền hồ sơ mở `/customers`, gọi API | Trang 404, API 403 |
| T3-28 | 10 | Nhân viên quản ngân hàng chưa có hồ sơ | "Chưa có hồ sơ nào." |
| T3-29 | 11 | Xuất Excel khi đang tìm và lọc | Đúng số dòng và đúng hồ sơ của bộ lọc |
| T3-30 | 11 | Xuất Excel khi bộ lọc không khớp | Vẫn tải được file: 3 dòng đầu, dòng tổng ghi 0, không có dòng dữ liệu |
| T3-31 | 11 | Xuất Excel hồ sơ có tên, lớp, phụ huynh bắt đầu `=`, `+`, `-`, `@`, tên 100 ký tự, ký tự đặc biệt | Ô là chữ, không phải công thức; giữ nguyên văn sau khi viết hoa bỏ dấu; SĐT giữ số 0 đầu |
| T3-32 | 8, 11 | Nhân viên quản B2 có quyền Xuất Excel | File chỉ có hồ sơ có B2 |
| T3-33 | 2, 11 | Xuất Excel với `q=%00` | Tải được file, không lỗi 500 |
| T3-34 | 6, 11 | Xuất Excel lọc từ ngày bằng tới ngày 31/10/2026, rồi 01/11/2026 | Ngày 31/10 chỉ ra hồ sơ 23:30; cột GỬI LÚC ghi 31/10/2026 23:30, NGÀY CẤP ghi 31/10/2026 23:45; ngày 01/11 chỉ ra hồ sơ 00:30 |
| T3-35 | 5, 9 | Lọc Chờ kiểm tra còn 1 dòng ở trang 2; mở hồ sơ đó, bấm Đạt, bấm Quay lại của trình duyệt | Trang ghi "1 / 1", không có trang rỗng, không còn dòng vừa Đạt |

Không áp dụng ở Trang 3:
- Loại 7: Trang 3 không có form ngoài ô tìm, ô tìm xét ở loại 3.
- Loại 12: không có link do người dùng nhập; link duy nhất là link tới chi tiết hồ sơ do máy chủ dựng từ id.
- Loại 13: Trang 3 không hiện ảnh.

## Ca của Trang 4: chi tiết hồ sơ

| Mã | Loại | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|---|
| T4-01 | 1, 14 | Hồ sơ tên 100 ký tự có dấu cách, phụ huynh 100 ký tự, trường 95 ký tự, ngân hàng 80 ký tự; khổ 1366x768 và 390x844 | Cả trang không cuộn ngang; nút Sửa thông tin, Đạt, Không đạt, Tải ảnh thay thế, bút chì ghi chú nằm trọn trong màn hình |
| T4-02 | 1, 14 | Hồ sơ tên 100 ký tự liền, phụ huynh 100 ký tự liền, ghi chú 1.000 ký tự liền | Như T4-01; ghi chú xuống dòng trong khung |
| T4-03 | 1, 14 | Mở hộp thoại Đánh dấu Đạt, Ghi chú, Sửa thông tin của hồ sơ T4-01, T4-02 ở 390x844 | Hộp thoại nằm trọn bề ngang, nút gửi bấm được, ô nhập không tràn khỏi hộp |
| T4-04 | 2 | Hồ sơ tên có `<script>`, `<img onerror>`; ghi chú có `<b>đậm</b>`, xuống dòng, emoji | Hiện nguyên văn dạng chữ, không tạo thẻ, xuống dòng giữ nguyên |
| T4-05 | 2, 7 | Ghi chú qua API có ký tự điều khiển; ghi chú có khoảng trắng đầu cuối | Ký tự điều khiển nhận 400 "Có ký tự không hợp lệ"; khoảng trắng đầu cuối bị cắt |
| T4-06 | 4 | `/customers/abc`, `/customers/<uuid không có>`; API GET, PATCH với id sai | Trang 404, API 404, không lỗi 500 |
| T4-07 | 6 | Hồ sơ có voucher cấp 23:45 ngày 31/10 giờ Việt Nam | "Ngày cấp" ghi 31/10/2026 23:45 |
| T4-08 | 7 | Sửa thông tin: họ tên trống, họ tên chỉ khoảng trắng, lớp trống | "Nhập họ và tên", "Nhập lớp" ở đúng ô |
| T4-09 | 7 | Họ tên 101 ký tự, lớp 21 ký tự | "Tối đa 100 ký tự", "Tối đa 20 ký tự" ở đúng ô |
| T4-10 | 7 | SĐT "+84912345678", 9 số, có chữ; SĐT học sinh trùng SĐT phụ huynh | Lỗi dạng SĐT ở đúng ô; trùng thì lỗi ở ô SĐT phụ huynh |
| T4-11 | 7 | SĐT "0912 345 678", tên nhiều khoảng trắng liền, lớp "12 a1" | Lưu được; hiện "0912 345 678", tên gọn một khoảng trắng, lớp "12A1" |
| T4-12 | 7 | Nhấn Enter trong ô Họ tên; bấm Lưu hai lần liền | Enter gửi form; hai lần bấm chỉ gửi một request |
| T4-13 | 7 | Gõ dở rồi Huỷ, mở lại | Form hiện dữ liệu đã lưu, không giữ chữ vừa gõ |
| T4-14 | 7 | Ghi chú 1.000 ký tự; 1.001 ký tự qua API | 1.000 lưu được, ô nhập chặn ở 1.000; API nhận 400 "Ghi chú tối đa 1000 ký tự" |
| T4-15 | 7, 13 | Tải ảnh thay thế: không chọn file, file 0 byte, file chữ đổi đuôi `.jpg`, file 21 MB, 23 MB; Nginx trả 413 dạng HTML | Báo lỗi dưới ô Ảnh, không tải gì lên; file trên 20 MB không gửi request nào; 413 báo "Ảnh lớn hơn 20 MB." dưới ô Ảnh |
| T4-16 | 8 | `zz_e2e_bien1` mở hồ sơ chỉ có B2; gọi API GET, PATCH hồ sơ, đánh dấu, ghi chú, thay ảnh của dòng B2 | Trang 404, mọi API 404 |
| T4-17 | 8, 13 | `zz_e2e_bien1` mở hồ sơ có B1 và B2 | Thẻ B2 không có ảnh, ghi chú, nút; route ảnh của B2 trả 404 |
| T4-18 | 8 | Gọi API ghi (đánh dấu, ghi chú, sửa thông tin) không có Origin, hoặc Origin trang khác | 403 |
| T4-19 | 9 | Hai tab cùng mở hồ sơ; tab A đánh dấu Đạt; tab B bấm Đạt, rồi Không đạt | Tab B báo "Ngân hàng này đã có người đánh dấu. Tải lại trang để xem kết quả mới."; trang Mã voucher ra "1 mã" |
| T4-20 | 9 | Tab A đánh dấu Đạt (cấp voucher); tab B đang mở Sửa thông tin bấm Lưu | Tab B báo "Hồ sơ đã có voucher, không sửa được thông tin." ở dòng báo chung |
| T4-21 | 9 | Tab A đánh dấu Đạt; tab B tải ảnh thay thế | Tab B báo "Ngân hàng đã Đạt, không thay được ảnh." |
| T4-22 | 9 | Hai tab sửa ghi chú cùng một ngân hàng | Người lưu sau ghi đè, tải lại thấy ghi chú của người lưu sau |
| T4-23 | 10 | Quản trị mở hồ sơ chưa chọn ngân hàng; ngân hàng chưa có ảnh, chưa có ghi chú | Chỉ có thẻ Thông tin và SMS "Chưa gửi"; khung ảnh ghi "Chưa có ảnh"; "Chưa có ghi chú" |
| T4-24 | 13 | Route ảnh với id sai dạng, id không có | 404 |
| T4-25 | 2 | Hai hồ sơ trùng tên và SĐT, một ở trường tên dài | Mỗi hồ sơ có link sang hồ sơ kia, ghi tên và trường |
| T4-28 | 9 | Tab A tải ảnh thay thế; tab B đang mở trang cũ bấm Đạt | Tab B báo "Ảnh vừa được thay. Tải lại trang để xem ảnh mới.", không có voucher; tải lại trang thì thấy ảnh mới, Đạt được, đúng 1 voucher |
| T4-29 | 7, 9 | Bấm Esc, Huỷ, nút Đóng lúc hộp Tải ảnh thay thế hay Ghi chú đang gửi | Huỷ bị khoá, hộp còn mở; máy chủ trả lời xong thì hộp đóng |
| T4-30 | 9 | Hai tab cùng bấm nút Đạt trong hộp xác nhận đúng một lúc | Một tab Đạt, tab kia báo đã có người đánh dấu; 1 voucher, 1 tin SMS |
| T4-31 | 9 | Tab A bấm Không đạt; tab B đang mở trang cũ bấm Đạt | Tab B báo đã có người đánh dấu; tải lại trang thì Đạt được, đúng 1 voucher |
| T4-32 | 7 | Bấm đúp nút Đạt trong hộp xác nhận | Chỉ một request |
| T4-33 | 8, 9 | `zz_e2e_bien4` mở hộp Ghi chú, Tải ảnh thay thế, Sửa thông tin, Gửi lại SMS; quản trị bỏ giao B2; bấm gửi ở từng hộp | Ghi chú, Tải lên báo "Không tìm thấy ngân hàng của hồ sơ.", Sửa thông tin báo "Không tìm thấy hồ sơ.", Gửi lại báo "Không tìm thấy tin SMS.", đều ở dòng báo chung, không ô nào bị đánh dấu sai |
| T4-34 | 9 | Quản trị gỡ khung ảnh lúc hộp Tải ảnh thay thế đang mở | "Không tìm thấy khung ảnh." dưới ô Khung ảnh |

Không áp dụng ở Trang 4:
- Loại 3, 5: trang không có ô tìm, không phân trang.
- Loại 11: trang không có Xuất Excel.
- Loại 12: link duy nhất do dữ liệu tạo là `tel:` của SĐT phụ huynh, SĐT đã qua kiểm dạng `^0[0-9]{9}$` ở form và check của DB.
- Lightbox: Trang 4 mở ảnh ở tab mới qua route kiểm quyền, không dùng `ImageLightbox`. Thiết kế không ghi lightbox ở Trang 4.

## Ca của trang Ngân hàng nhóm Nghiệp vụ

| Mã | Loại | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|---|
| NH-01 | 1, 14 | Dòng có ngân hàng 80 ký tự, trường 95 ký tự, họ tên 100 ký tự liền; lọc theo trường tên dài; khổ 1366x768 và 390x844 | Cả trang không cuộn ngang; chip "Trường: ..." xuống dòng trong màn hình |
| NH-02 | 2, 4 | URL `q=%00`; ô tìm trường của bộ lọc với `%`, `_`, NUL | Không lỗi 500; ô tìm trường coi `%` `_` là chữ |
| NH-03 | 3 | Tìm nhiều từ khác thứ tự, SĐT phụ huynh có dấu cách | Như Trang 3 |
| NH-04 | 4 | `bank=abc`, `bank=<B2>` khi Nhân viên quản B1, `school=<uuid không có>`, `status=foo`, `dir=foo`, `page=abc` | Bỏ giá trị lạ, không có chip kẹt, không lỗi 500 |
| NH-05 | 4 | Bấm cột Ngày để đổi chiều khi đang tìm, lọc và ở trang 2 | Giữ tìm và lọc, về trang 1, thứ tự đảo |
| NH-06 | 5 | 17 dòng của 16 hồ sơ | Trang 1 đúng 15 dòng, trang 2 hai dòng |
| NH-07 | 6 | Lọc trọn ngày 31/10 và 01/11 | Như T3-23, theo ngày tạo hồ sơ |
| NH-08 | 8 | `zz_e2e_bien1` | Chỉ thấy dòng B1; không có mục lọc Ngân hàng |
| NH-09 | 10 | `zz_e2e_bien3`; tìm không khớp | "Chưa có học sinh chọn ngân hàng."; "Không có dòng nào khớp bộ lọc." |
| NH-10 | 11 | Xuất Excel có lọc, không có dòng nào, ký tự công thức | Như T3-29 tới T3-31 |
| NH-11 | 6, 11 | Xuất Excel lọc trọn ngày 31/10 | Chỉ ra dòng 23:30; NGÀY ghi 31/10/2026 23:30, KIỂM LÚC ghi 31/10/2026 23:45 |
| NH-12 | 5, 9 | Như T3-35 ở trang Ngân hàng | Như T3-35 |

Không áp dụng: loại 7 (trang không có form), loại 9 (trang chỉ đọc), loại 12 (không có link người dùng nhập), loại 13 (không hiện ảnh).

## Ca của Trang 12: Mã voucher

| Mã | Loại | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|---|
| VC-01 | 1, 14 | Voucher của hồ sơ tên dài, trường dài; khổ 390x844 | Cả trang không cuộn ngang |
| VC-02 | 2, 4 | URL `q=%00`, `q=%`, `from=0001-01-01`, `page=-1` | Không lỗi 500 |
| VC-03 | 3 | Tìm mã một phần chữ thường; họ tên không dấu; nhiều từ khác thứ tự; một từ của mã và hai từ của tên: "bpt07 phan trang" | Ra đúng mã; "bpt07 phan trang" ra mã BPT07 của "Biên Phân Trang 07" |
| VC-04 | 5 | 16 mã của 16 hồ sơ | Trang 1 đúng 15 dòng, trang 2 một dòng |
| VC-05 | 6 | Mã cấp 23:45 ngày 31/10 và 00:45 ngày 01/11; lọc trọn ngày | Hiện đúng giờ Việt Nam; ngày 31/10 ra mã 23:45, ngày 01/11 ra mã 00:45 |
| VC-06 | 8 | `zz_e2e_bien1` không có quyền voucher | Trang 404, API 403 |
| VC-07 | 10 | Tìm không khớp | "Không có mã khớp bộ lọc." |
| VC-08 | 11 | Xuất Excel có lọc, không có dòng nào; tên, lớp, phụ huynh bắt đầu bằng `=`, `+`, `-`, `@` | Như T3-29 tới T3-31 |
| VC-09 | 6, 11 | Xuất Excel lọc trọn ngày cấp 31/10, rồi 01/11 | Ngày 31/10 chỉ ra mã 23:45, NGÀY CẤP ghi 31/10/2026 23:45; ngày 01/11 chỉ ra mã 00:45 |

Không áp dụng: loại 7, 9 (trang chỉ đọc), loại 12, 13.

## Ca của Tin SMS lỗi

| Mã | Loại | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|---|
| SMS-01 | 1, 14 | Tin của hồ sơ tên dài; hộp thoại Gửi lại; khổ 390x844 | Cả trang không cuộn ngang; hộp thoại nằm trọn bề ngang |
| SMS-02 | 2, 4 | URL `q=%00`, `status=foo`, `page=999` | Không lỗi 500; `status=foo` về mặc định Lỗi |
| SMS-03 | 3 | Tìm họ tên nhiều từ khác thứ tự, SĐT nhận có dấu cách | Ra đúng tin |
| SMS-04 | 5 | 16 tin lỗi | Trang 1 đúng 15 dòng, trang 2 một dòng |
| SMS-05 | 7 | Gửi lại: SĐT trống, sai dạng, "0977 123 456" | Trống, sai dạng báo "SĐT phải có 10 số, bắt đầu bằng 0." ở ô; có dấu cách thì lưu "0977123456" |
| SMS-06 | 7 | Nhấn Enter trong ô SĐT nhận; Huỷ rồi mở lại | Enter gửi; mở lại hiện SĐT đang lưu, không giữ chữ vừa gõ |
| SMS-07 | 8 | `zz_e2e_bien1` gọi Gửi lại tin của hồ sơ chỉ có B2 | 404 |
| SMS-08 | 9 | Hai tab cùng Gửi lại một tin | Tab sau báo "Tin này không ở trạng thái lỗi." ở dòng báo chung, ô SĐT không bị đánh dấu sai |
| SMS-09 | 10 | `zz_e2e_bien3`; lọc Đã gửi khi không có tin đã gửi nào khớp; tìm không khớp | "Không có tin lỗi."; "Không có tin khớp bộ lọc." |
| SMS-10 | 5, 9 | Đang ở trang 2 chỉ có một tin lỗi; Gửi lại tin đó | Trang tải lại về trang còn dòng, không hiện trang rỗng |
| SMS-11 | 7, 9 | Bấm Esc, Huỷ, nút Đóng lúc hộp Gửi lại đang gửi | Huỷ bị khoá, hộp còn mở; máy chủ trả lời xong thì hộp đóng |
| SMS-12 | 9 | Như SMS-08, rồi đóng hộp; lần khác mất mạng rồi đóng hộp | Đóng hộp thì bảng tải lại, dòng Lỗi cũ mất; mất mạng thì đóng hộp không tải lại trang |
| SMS-13 | 1, 14 | Tin có cột Lỗi 500 ký tự liền; khổ 1366x768 và 390x844 | Trang Tin SMS lỗi và chi tiết hồ sơ không cuộn ngang |

Không áp dụng: loại 6 (cột Gửi lúc dùng chung hàm giờ Việt Nam với Trang 3, đã xét ở T3-22), loại 11 (trang không có Xuất Excel), loại 12, 13.

## Ca thuần logic máy chủ (test DB)

| Mã | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|
| DB-01 | `listCustomers`, `listCustomerBanks`, `listVouchers`, `listSms`, ô tìm trường với từ khoá có NUL | Không ném lỗi, NUL bị bỏ |
| DB-02 | Bộ lọc ngày năm 0001 và 0000 | Bỏ qua, không ném lỗi |
| DB-03 | Tìm nhiều từ khác thứ tự, bỏ từ giữa, quá 8 từ, quá 100 ký tự | Mỗi từ là một điều kiện; cắt ở 8 từ và 100 ký tự như mgst-app |
| DB-04 | Nhân viên đã mở trang rồi bị bỏ giao ngân hàng, bấm Đạt | 404, không ghi lịch sử |
| DB-05 | Máy chủ đặt `TZ=UTC`, xuất Excel Hồ sơ, Ngân hàng, Mã voucher lúc 00:30 ngày 01/11 giờ Việt Nam | Tên file ghi `2026-11-01` |
| DB-06 | Xuất Excel Hồ sơ, Ngân hàng, Mã voucher khi bộ lọc khớp 20.001 dòng | 400 "Danh sách có 20001 dòng, quá 20000 dòng một file. Lọc bớt rồi xuất lại.", không dựng file |
| DB-07 | Ảnh vừa được thay từ lúc mở trang, bấm Đạt; bấm Không đạt | Đạt nhận 409, dòng giữ Chờ kiểm tra, không có voucher, không ghi lịch sử; Không đạt vẫn ghi được |
| DB-08 | Mã voucher tìm "bpt07 phan trang" | Mỗi từ khớp mã hoặc họ tên |

## Kết quả

Test nằm ở `e2e/edge-business.spec.ts` (Trang 3), `e2e/edge-business-detail.spec.ts` (Trang 4), `e2e/edge-business-lists.spec.ts` (Ngân hàng, Mã voucher, Tin SMS lỗi), `tests/db/edgeBusiness.test.ts`, `tests/unit/edgeBusiness.test.ts`. Hàm dùng chung của các file e2e ở `e2e/edge-business-support.ts`.

### Lỗi tìm ra và đã sửa

| Ca | Lỗi người dùng gặp | Commit |
|---|---|---|
| T3-05, NH-02, VC-02, SMS-02, T3-33, DB-01 | URL hay ô tìm có `%00` làm trang và file Excel lỗi 500 | 7a23481 |
| T3-16, VC-02, DB-02 | URL lọc ngày năm 0001 hay 0000 làm trang lỗi 500 | 4d6712e |
| T3-16 | URL lọc ngày tháng 13 hay ngày 32 làm trang lỗi 500 | b836181 |
| T3-07, NH-03, VC-03, SMS-03, DB-03 | Gõ nhiều từ khác thứ tự hay bỏ từ giữa ("trang 07 bien") ra 0 hồ sơ | 804897c |
| T3-10 | Dán cả trang chữ vào ô tìm: ô nhận hết, URL dài tới mức máy chủ trả 431 | 56d0910 |
| T4-02 | Chi tiết hồ sơ có họ tên, phụ huynh, ghi chú liền không dấu cách: cả trang cuộn ngang gần 7.000 px | 0b80d11 |
| SMS-08 | Hai tab cùng Gửi lại một tin: tab sau đánh dấu ô SĐT nhận là sai, không có dòng báo chung | 3d7d526 |
| SMS-09 | Lọc Đã gửi mà không có tin khớp thì báo "Chưa có tin nào." | 20ff26e |
| T4-15 | Tải ảnh thay thế file trên 22 MB: câu báo nằm ở cuối hộp thoại, ô Ảnh không bị đánh dấu sai như file 21 MB | cd206ed |
| T4-26 | Lưu ghi chú lúc mất mạng: câu "Không kết nối được máy chủ" nằm dưới ô ghi chú và đánh dấu ô sai | bf7fa66 |
| T4-27 | Tải ảnh thay thế: huỷ hộp chọn file hay chọn lại đúng ảnh đang chọn thì cả hộp thoại đóng. Hộp Hướng dẫn ngân hàng và hộp Mã giới thiệu dùng chung `Dialog` nên cũng bị | ab3249d |
| VC-03, DB-08 | Gõ "bpt07 phan trang" ở ô tìm Mã voucher ra 0 mã: ô tìm so cả chuỗi với mã, rồi với họ tên | 64ddec2 |
| T4-28, DB-07 | Tab khác vừa thay ảnh, người kiểm bấm Đạt trên trang mở từ trước: máy chủ ghi Đạt và cấp voucher cho ảnh người kiểm chưa xem | 0ccf1ff |
| T4-15 | Ảnh trên 22 MB ở production: Nginx trả 413 dạng HTML, hộp Tải ảnh thay thế báo "Không tải được ảnh lên. Thử lại." ở cuối hộp. Trình duyệt vẫn gửi cả file trên 20 MB lên máy chủ | cce6e38 |
| T4-29, SMS-11 | Bấm Esc hay Huỷ lúc hộp Tải ảnh thay thế, Ghi chú, Gửi lại đang gửi: hộp đóng, người dùng tưởng đã huỷ, nhưng ảnh vẫn bị thay và tin vẫn gửi lại | 2de69e7 |
| SMS-12 | Gửi lại bị từ chối vì tab khác vừa gửi: đóng hộp xong dòng vẫn ghi Lỗi, bấm Gửi lại lần nữa ra đúng câu báo cũ | f08c652 |

Thêm ca trong lúc viết test:
- T4-26 (loại 7, 13): mất mạng khi lưu ghi chú và khi tải ảnh thay thế. Câu báo hiện ở dòng báo chung, ô nhập không bị đánh dấu sai; mạng có lại thì lưu được.
- T4-27 (loại 13): chọn lại đúng ảnh đang chọn. Chrome thấy lựa chọn không đổi thì phát sự kiện `cancel` từ ô file, như khi người dùng huỷ hộp chọn file. Sự kiện này nổi lên thẻ `<dialog>`, và `Dialog` coi nó như phím Esc. Hộp thoại phải giữ nguyên, bấm Tải lên vẫn gửi ảnh đang chọn. Test tải ảnh thay thế treo tới hết giờ vì lỗi này: bước T4-26 chọn `photo.jpg`, bước cuối chọn lại đúng file đó, hộp thoại đóng, Playwright chờ mãi nút Tải lên.
- T4-15 thêm file 23 MB: máy chủ chặn theo Content-Length trước khi đọc file, đường chặn này trả lỗi không gắn ô.
- T3-16 thêm `to=2026-13-01`: test này tìm ra lỗi 500 riêng, khác lỗi năm 0001.
- Review lần 1 tìm ra 12 ca sót. Ca 1 thành T4-30, ca 2 thành T4-31, ca 3 thành T4-28 và DB-07, ca 4 thành T3-34, NH-11, VC-09, ca 5 thành DB-05, ca 6 thành VC-08, ca 7 thành T3-35 và NH-12, ca 8 thành SMS-13, ca 9 thành T4-33, ca 10 thành T4-34, ca 11 thành T4-32, ca 12 thành DB-06. Chỉ ca 3 fail vì code; các ca khác pass ngay.

Sửa ở test, người dùng không gặp lỗi:
- 0021051 (M7): `loginAs` ghi lại context; mỗi file spec đóng context sau từng test.
- 455ac4d (M3): test chọn lại đúng ảnh phát thẳng sự kiện `cancel` lên ô file, kiểm hộp còn mở, rồi kiểm Esc vẫn đóng hộp. Test không còn dựa vào việc Chromium tự phát `cancel`.
- a37ba01 (M5): seed voucher cho hai hồ sơ có ký tự công thức, VC-08 kiểm các ô đó là chữ. T4-19 đếm voucher ở trang Mã voucher.
- 86f01ba (M2): `scripts/e2e-run.sh` chạy `next start` với `TZ=UTC`. Máy dev và container production đều ở +07, nên code lỡ dùng giờ của máy vẫn qua test nếu không ép UTC.
- 5395041, 0d17aea, 021cf2a, fafee70, 842fceb, 11eb66b, 71390c8: test cho các ca sót, mỗi ca một commit. ed24bff sửa kiểu ở test DB-06 cho tsc.

### Ruling

- Tìm nhiều từ: mỗi từ là một điều kiện, không theo thứ tự; máy chủ cắt chuỗi ở 100 ký tự rồi lấy tối đa 8 từ. Chép `searchTerms` ở `../mgst-app/src/lib/search.ts`. Tìm SĐT giữ nguyên luật cũ: 3 tới 10 chữ số sau khi bỏ dấu cách và dấu chấm.
- Ô tìm nhận tối đa 100 ký tự (`maxLength`), như `SEARCH_MAX_LENGTH` của mgst-app.
- Ký tự NUL: mgst-app không có luật. Máy chủ bỏ NUL khỏi tham số URL và mẫu LIKE, phần còn lại vẫn tìm. Postgres không lưu được NUL, nên bỏ đi thì kết quả giống hệt khi không gõ NUL. Ô chọn trường với `q=%00` vì thế trả như ô trống.
- Ngày trên URL trước 1900-01-01 bị bỏ qua như ngày sai: mgst-app không có luật, chương trình bắt đầu năm 2026 nên không có bản ghi nào trước 1900.
- Hai tab cùng sửa ghi chú: người lưu sau ghi đè, giữ như code hiện có. Ghi chú là chữ nội bộ, không đổi trạng thái, voucher hay SMS.
- Lỗi không thuộc ô nào (409 vì tab khác vừa làm, 404, mất mạng) hiện ở dòng báo chung `role="alert"`, ô nhập không bị đánh dấu sai. Hộp Sửa thông tin và Tải ảnh thay thế đã làm vậy; hộp Gửi lại SMS và Ghi chú chép theo.
- Bảng Bộ lọc mở lại thì giữ mục lọc vừa chọn ở cột trái, kể cả sau khi bấm Quay lại của trình duyệt. Đây là cách `FilterButton` đang làm; giá trị trong mục vẫn khớp URL. Test T3-18 bấm mục Trạng thái trước khi kiểm ô chọn.
- T3-21 chuyển sang SMS-10: trang SMS có nút Gửi lại làm dòng biến mất ngay trên trang. Mỗi hàm danh sách có phép kẹp trang riêng, nên Trang 3 vẫn có T3-14 phủ (`page=999` ra "2 / 2") và T3-35 phủ ca dòng cuối đổi trạng thái.
- DB-04 (bị bỏ giao ngân hàng giữa phiên) test bằng test DB: e2e không đổi được quyền giữa chừng mà không đụng tài khoản của nhóm khác.
- Ruling: Mã voucher tìm theo từng từ, thay ruling cũ "so cả chuỗi". Mỗi từ khớp mã hoặc họ tên, như `../mgst-app/src/server/banking.ts:464-476` và `matchesEachTerm` nhóm C dùng ở 369a1eb. Từ so với mã được viết hoa trước.
- Ruling: bấm Đạt trên ảnh cũ. mgst-app không có luật cho ảnh. Luật gần nhất là duyệt tạm ứng lương (`../mgst-app/src/server/salaryAdvances.ts:527-529`): số tiền vừa đổi thì từ chối, người duyệt phải thấy đúng số mình duyệt. Trang gửi id các ảnh đang dùng lúc mở. Máy chủ so với ảnh đang dùng trong transaction đã khoá dòng hồ sơ; thay ảnh khoá cùng dòng đó, nên không ảnh nào lọt vào giữa. Khác thì trả 409 "Ảnh vừa được thay. Tải lại trang để xem ảnh mới.". Máy chủ chỉ so ảnh khi bấm Đạt: Đạt cấp voucher không đảo lại được, còn Không đạt sửa lại được thành Đạt. API không bắt buộc gửi `photos`; lệnh gọi không gửi thì máy chủ không so ảnh.
- Ruling: chặn đóng hộp lúc đang gửi (M1). `Dialog` của mgi-bank không có prop `dismissible` như mgst-app. Hộp Tải ảnh thay thế, Ghi chú, Gửi lại tự bỏ qua `onClose` khi đang gửi và khoá nút Huỷ, như 42ff72b của nhóm C. Nút Đóng ở góc vẫn hiện nhưng không đóng hộp khi đang gửi.
- Ruling: Gửi lại bị từ chối (M6). Bảng tải lại lúc đóng hộp, không tải ngay, để người dùng còn đọc câu báo. Chỉ tải lại khi máy chủ đã trả lời và lỗi không thuộc ô SĐT nhận. Mất mạng thì không tải lại: `router.refresh()` lúc mất mạng chuyển sang trang lỗi của trình duyệt.
- Ruling: kiểm ảnh ở trình duyệt (I1) chỉ chép phần dung lượng của `imageProblem` (`../mgst-app/src/lib/api/uploads.ts:35`). Phần loại file vẫn do máy chủ kiểm theo nội dung file, ô file đã có `accept` ảnh. File chữ đổi đuôi `.jpg` có `type` là `image/jpeg`, nên kiểm `type` ở trình duyệt không chặn được ca đó.
- Ruling: T4-34 gỡ khung ảnh B2 bằng API Hướng dẫn ngân hàng (PUT kèm `seenSlotIds`), đúng việc quản trị làm ở trang Ngân hàng. T4-33 dùng `zz_e2e_bien4` quản cả B2 và B3: bỏ giao B2 thì người này vẫn vào được trang nghiệp vụ, nên API trả 404 chứ không phải 403.
- Ruling: DB-06 (quá 20.000 dòng) test ở tầng DB. Test dựng 20.001 hồ sơ bằng `generate_series` trên DB tạm, dọn trong `finally`. Seed 20.000 dòng vào e2e làm mọi lượt e2e chậm đi. DB-05 đặt `TZ=UTC` và giờ hệ thống 2026-10-31T17:30Z ngay trong test.

### Chờ

- Đã xong ở 32fd07d (nhóm C): Xuất Excel trang Trường với `q=%00` lỗi 500. Route `src/app/api/admin/schools/export/route.ts` đọc `q` bằng `searchParams.get`, không qua `readParam`, rồi `exportSchools` ghi `q` vào `audit_log.detail` (jsonb không nhận NUL). Nhóm C chuyển 4 route sang `readParam`.
- Đã xong ở 369a1eb (nhóm C): ô tìm của Trường, Tài khoản, Kho mã và ô chọn người quản tìm cả chuỗi bằng `matchesPlain`, chưa tách từ như mgst-app. Nhóm C thêm `matchesEachTerm` ở `src/server/search.ts`, dùng lại `searchTerms` của nhóm B.
- Hộp Sửa thông tin ở Trang 4 vẫn đóng được bằng Esc hay Huỷ lúc đang lưu. M1 chỉ nêu ba hộp Tải ảnh thay thế, Ghi chú, Gửi lại, nên lượt này chưa sửa.
- Web học sinh cũng không kiểm dung lượng ảnh ở trình duyệt (review nhóm B ghi ở I1). Việc này thuộc nhóm A.
- M4 (chuyển `searchTerms` sang `src/lib/search.ts`): nhóm C làm.

### Ca chưa test được

- Tài khoản bị khoá hay bị tắt giữa phiên ở các trang nghiệp vụ: phần đăng nhập và phiên thuộc nhóm C. Nhóm B chỉ test được ca bị bỏ giao ngân hàng (DB-04).
- Tin SMS đang gửi chuyển sang lỗi đúng lúc người dùng bấm Gửi lại: cần worker SMS chạy thật, e2e không bật worker.
- Ảnh HEIC, ảnh rất lớn về số pixel ở Tải ảnh thay thế: đường xử lý ảnh dùng chung với web học sinh, nhóm A test ở đó. Nhóm B test file chữ đổi đuôi, 0 byte, 21 MB, 23 MB, mất mạng và chọn lại đúng ảnh đang chọn.
- Nginx thật chặn file trên 22 MB: e2e chạy không có Nginx. T4-15 giả câu trả lời 413 dạng HTML bằng `route.fulfill`.

### Kết quả các lệnh

Chạy 2026-11-07 trên nhánh `dev`, sau commit ed24bff, sau khi sửa review lần 1.

| Lệnh | Kết quả |
|---|---|
| `bun run test` | 233 pass, 0 fail |
| `bunx tsc --noEmit` | 0 lỗi |
| `bun run lint` | 0 lỗi, 2 cảnh báo `no-img-element` có từ trước ở `GuideDialog.tsx` và `CodeFormDialog.tsx` |
| `bun test:db` trên DB tạm `zz_test_edge_b2` | 264 pass, 0 fail |
| `bun run e2e e2e/edge-business.spec.ts e2e/edge-business-detail.spec.ts e2e/edge-business-lists.spec.ts` | 46 pass, 0 fail |
| `bun run e2e` toàn bộ project chromium, `next start` chạy với `TZ=UTC` | 245 pass, 0 fail, 10,5 phút |

Lượt toàn bộ với `TZ=UTC` không có test nào fail vì giờ, ở cả ba nhóm.

Lượt trước, 2026-11-06 sau commit ab3249d: `bun run test` 232 pass, `bun test:db` trên `zz_test_edge_b` 253 pass, 3 spec nhóm B 32 pass.
