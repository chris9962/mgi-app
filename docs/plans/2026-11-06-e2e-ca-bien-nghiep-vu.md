# E2E ca biên nhóm B: nghiệp vụ

Kế hoạch chung ở `docs/plans/2026-11-06-e2e-ca-bien.md`. File này ghi danh sách ca của nhóm B, rồi ghi kết quả.

Phạm vi: Hồ sơ học sinh (`/customers`), chi tiết hồ sơ (`/customers/[id]`), Ngân hàng nhóm Nghiệp vụ (`/customer-banks`), Mã voucher (`/vouchers`), Tin SMS lỗi (`/sms`), xuất Excel của các trang này, API ở `src/app/api/admin/customers/**`, `customer-banks/**`, `photos/[id]`, `vouchers/**`, `sms/**`.

## Dữ liệu test

Seed riêng ở `scripts/e2e-seed-business.ts`, gắn vào `scripts/e2e-seed.ts` bằng một dòng. Mọi trường và ngân hàng mang tiền tố `ZZE2E `, tài khoản mang tiền tố `zz_e2e_`, nên `scripts/e2e-clean.ts` dọn được như dữ liệu e2e cũ.

- Trường B "ZZE2E THPT Biên Nghiệp Vụ ..." (khoảng 95 ký tự, có dấu cách) và trường B2 "ZZE2E THPT Biên Hai".
- Ngân hàng B1 tên khoảng 80 ký tự có dấu cách, B2 tên ngắn, B3 không có hồ sơ nào. Mỗi ngân hàng một khung ảnh, một mã giới thiệu.
- Tài khoản Nhân viên: `zz_e2e_bien1` quản B1, `zz_e2e_bien2` quản B2 và có quyền Xuất Excel, `zz_e2e_bien3` quản B3.
- 16 hồ sơ "Biên Phân Trang 01" tới "16": B1 Đạt, có voucher, có tin SMS lỗi. Hồ sơ 16 có thêm B2 đang chờ kiểm tra.
- Hồ sơ "Biên Giờ Khuya" tạo 23:30 ngày 31/10/2026 giờ Việt Nam, "Biên Giờ Sớm" tạo 00:30 ngày 01/11/2026. Voucher cấp lúc 23:45 và 00:15.
- Hồ sơ tên dài 100 ký tự có dấu cách, hồ sơ tên 100 ký tự liền không dấu cách kèm ghi chú 1.000 ký tự liền.
- Hồ sơ tên có `<script>`, `<img onerror>`, ngoặc kép, ngoặc đơn, `%`, `_`, `\`, emoji, chữ `Ð`, và hồ sơ có tên, lớp, phụ huynh bắt đầu bằng `=`, `+`, `-`, `@`.
- Hồ sơ chỉ có B2, hồ sơ có cả B1 và B2 kèm ảnh ở cả hai, hồ sơ chưa chọn ngân hàng, hai hồ sơ trùng tên và SĐT.
- Các hồ sơ riêng cho từng ca đồng thời (hai tab hậu kiểm, hai tab sửa thông tin, thay ảnh, ghi chú, Gửi lại).

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
| T3-21 | 5, 9 | Đang ở trang 2 có một dòng của bộ lọc Chờ kiểm tra; dòng đó được đánh dấu xong; tải lại | Về trang cuối mới, không hiện trang rỗng |
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
| T4-15 | 7, 13 | Tải ảnh thay thế: không chọn file, file 0 byte, file chữ đổi đuôi `.jpg`, file 21 MB | Báo lỗi dưới ô Ảnh, không tải gì lên |
| T4-16 | 8 | `zz_e2e_bien1` mở hồ sơ chỉ có B2; gọi API GET, PATCH hồ sơ, đánh dấu, ghi chú, thay ảnh của dòng B2 | Trang 404, mọi API 404 |
| T4-17 | 8, 13 | `zz_e2e_bien1` mở hồ sơ có B1 và B2 | Thẻ B2 không có ảnh, ghi chú, nút; route ảnh của B2 trả 404 |
| T4-18 | 8 | Gọi API ghi (đánh dấu, ghi chú, sửa thông tin) không có Origin, hoặc Origin trang khác | 403 |
| T4-19 | 9 | Hai tab cùng mở hồ sơ; tab A đánh dấu Đạt; tab B bấm Đạt, rồi Không đạt | Tab B báo "Ngân hàng này đã có người đánh dấu. Tải lại trang để xem kết quả mới."; chỉ một voucher |
| T4-20 | 9 | Tab A đánh dấu Đạt (cấp voucher); tab B đang mở Sửa thông tin bấm Lưu | Tab B báo "Hồ sơ đã có voucher, không sửa được thông tin." ở dòng báo chung |
| T4-21 | 9 | Tab A đánh dấu Đạt; tab B tải ảnh thay thế | Tab B báo "Ngân hàng đã Đạt, không thay được ảnh." |
| T4-22 | 9 | Hai tab sửa ghi chú cùng một ngân hàng | Người lưu sau ghi đè, tải lại thấy ghi chú của người lưu sau |
| T4-23 | 10 | Quản trị mở hồ sơ chưa chọn ngân hàng; ngân hàng chưa có ảnh, chưa có ghi chú | Chỉ có thẻ Thông tin và SMS "Chưa gửi"; khung ảnh ghi "Chưa có ảnh"; "Chưa có ghi chú" |
| T4-24 | 13 | Route ảnh với id sai dạng, id không có | 404 |
| T4-25 | 2 | Hai hồ sơ trùng tên và SĐT, một ở trường tên dài | Mỗi hồ sơ có link sang hồ sơ kia, ghi tên và trường |

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

Không áp dụng: loại 7 (trang không có form), loại 9 (trang chỉ đọc), loại 12 (không có link người dùng nhập), loại 13 (không hiện ảnh).

## Ca của Trang 12: Mã voucher

| Mã | Loại | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|---|
| VC-01 | 1, 14 | Voucher của hồ sơ tên dài, trường dài; khổ 390x844 | Cả trang không cuộn ngang |
| VC-02 | 2, 4 | URL `q=%00`, `q=%`, `from=0001-01-01`, `page=-1` | Không lỗi 500 |
| VC-03 | 3 | Tìm mã một phần chữ thường; họ tên không dấu; nhiều từ khác thứ tự | Ra đúng mã |
| VC-04 | 5 | 16 mã của 16 hồ sơ | Trang 1 đúng 15 dòng, trang 2 một dòng |
| VC-05 | 6 | Mã cấp 23:45 ngày 31/10 và 00:15 ngày 01/11; lọc trọn ngày | Hiện đúng giờ Việt Nam; ngày 31/10 ra mã 23:45, ngày 01/11 ra mã 00:15 |
| VC-06 | 8 | `zz_e2e_bien1` không có quyền voucher | Trang 404, API 403 |
| VC-07 | 10 | Tìm không khớp | "Không có mã khớp bộ lọc." |
| VC-08 | 11 | Xuất Excel có lọc, không có dòng nào, ký tự công thức | Như T3-29 tới T3-31 |

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

Không áp dụng: loại 6 (cột Gửi lúc dùng chung hàm giờ Việt Nam với Trang 3, đã xét ở T3-22), loại 11 (trang không có Xuất Excel), loại 12, 13.

## Ca thuần logic máy chủ (test DB)

| Mã | Thao tác hoặc dữ liệu vào | Kết quả đúng |
|---|---|---|
| DB-01 | `listCustomers`, `listCustomerBanks`, `listVouchers`, `listSms`, ô tìm trường với từ khoá có NUL | Không ném lỗi, NUL bị bỏ |
| DB-02 | Bộ lọc ngày năm 0001 và 0000 | Bỏ qua, không ném lỗi |
| DB-03 | Tìm nhiều từ khác thứ tự, bỏ từ giữa, quá 8 từ, quá 100 ký tự | Mỗi từ là một điều kiện; cắt ở 8 từ và 100 ký tự như mgst-app |
| DB-04 | Nhân viên đã mở trang rồi bị bỏ giao ngân hàng, bấm Đạt | 404, không ghi lịch sử |
