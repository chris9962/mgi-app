# Giai đoạn 3: Cấu hình trường, ngân hàng, mã giới thiệu

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** người quản ngân hàng tạo được trường, ngân hàng có khung ảnh, mã giới thiệu gắn cho trường. Kho mã hiện số lượt theo tháng. Quản trị sửa được Cài đặt.

**Kiến trúc:** trang server component đọc dữ liệu qua `src/server/*`. Ghi qua `/api/admin/*`. Ảnh tải lên máy chủ rồi máy chủ ghi vào S3, giống mgst-app. Ảnh đọc ra qua route kiểm phiên rồi chuyển hướng sang presigned URL 10 phút.

**Công nghệ:** `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `zxing-wasm` (đọc QR trên trình duyệt như mgst-app), `qrcode` (sinh ảnh QR của trường).

**Thiết kế gốc:** Trang 5 tới 11, Trang 17, bảng `schools`, `banks`, `bank_photo_slots`, `referral_codes`, `referral_code_months`, `referral_code_schools`, `settings` trong `Minh group/Mở tài khoản học sinh qua QR trường.html`.

## Ràng buộc

- S3: bucket riêng của mgi-bank. Máy local dùng `mgi-bank-dev`. Code từ chối bucket `mgst-images`.
- Khoá ảnh dạng `<thư mục>/<yyyy-mm-dd>/<uuid>.<đuôi>`. Máy chủ nhận diện ảnh bằng chữ ký đầu file, không tin Content-Type.
- Quyền: Trường cần quyền `schools`. Tạo ngân hàng, giao người quản, sửa mọi ngân hàng cần `manage_banks`. Nhân viên được giao ngân hàng sửa thông tin, hướng dẫn, mã của đúng ngân hàng đó. Cài đặt chỉ Quản trị.
- Số lượt của mã trong tháng: dòng `referral_code_months` của tháng đó, chưa có dòng thì lấy `monthly_quota`. Sửa số lượt thì đổi `monthly_quota` và dòng của tháng đang chạy, tháng đã qua giữ nguyên.
- Đếm lượt theo `customer_banks(referral_code_id, year_month)`: `passed` là hoàn thành, `selected` và `pending` là đang giữ, `failed` là không đạt. Trạng thái mã chỉ có Còn chỗ, Hết chỗ, cộng Đã ngừng khi tắt.
- Danh sách lớn dần (trường, mã) phân trang, tìm, lọc ở máy chủ. Ô chọn trường trong hộp thoại mã tìm qua route riêng, tối đa 20 dòng.

## Task 1: Kho ảnh S3 và đọc ghi ảnh

**Files:** `src/server/storage.ts`, `src/app/api/admin/uploads/route.ts`, `src/app/api/admin/images/route.ts`, `tests/unit/storage.test.ts`, `tests/s3/storage.test.ts`

- [ ] Test unit: khoá đúng dạng thì nhận, `../.env`, `javascript:` thì từ chối. Chữ ký jpg, png, webp, heic nhận ra đúng; file text không nhận.
- [ ] Test S3 trên `mgi-bank-dev`: ghi ảnh, presign GET, tải về đúng byte, xoá.
- [ ] Route tải ảnh lên: thư mục `samples` hoặc `qr`, tối đa 10 MB, trả khoá. Route đọc ảnh: kiểm phiên rồi chuyển hướng 302 sang presigned URL.

## Task 2: Trường (Trang 5, 6)

**Files:** `src/server/schools.ts`, `src/lib/schoolForm.ts`, `src/app/api/admin/schools/**`, `src/app/api/admin/wards/route.ts`, `src/app/admin/(shell)/schools/**`, `src/components/ui/Combobox.tsx`, `tests/db/schools.test.ts`

- [ ] Test DB: tạo, sửa, đóng mở trường, ghi `audit_log`. Danh sách tìm theo tên trường, tên xã. Xã phải thuộc tỉnh đã chọn.
- [ ] Trang danh sách: Trường, Địa chỉ, Người liên hệ, Hồ sơ, Đạt ≥ 1, Trạng thái, Thao tác. Hộp thoại: Tên trường, Tỉnh/thành phố, Xã/phường, Họ tên và SĐT người liên hệ.
- [ ] Tải ảnh QR của trường: PNG chứa `https://<STUDENT_HOST>/t/<id>`.

## Task 3: Ngân hàng và hướng dẫn (Trang 7, 8, 9)

**Files:** `src/server/banks.ts`, `src/lib/bankForm.ts`, `src/app/api/admin/banks/**`, `src/app/api/admin/users/options/route.ts`, `src/app/admin/(shell)/banks/**`, `src/components/ui/MultiSelect.tsx`, `tests/db/banks.test.ts`

- [ ] Test DB: chỉ `manage_banks` tạo ngân hàng và giao người quản. Nhân viên được giao sửa được tên, ưu tiên, hướng dẫn của ngân hàng mình, không sửa được ngân hàng khác. Bỏ khung ảnh thì ghi `removed_at`, không xoá dòng.
- [ ] Danh sách: Mã, Tên, Ưu tiên, Ảnh cần nộp, Mã còn chỗ, Người quản, Trạng thái, Thao tác.
- [ ] Hộp thoại sửa: mã, độ ưu tiên, tên, người quản. Hộp thoại Hướng dẫn: các bước, khung ảnh có tên, ảnh mẫu, hai ô tick Họ tên và Mã giới thiệu.

## Task 4: Kho mã giới thiệu (Trang 10, 11)

**Files:** `src/server/referralCodes.ts`, `src/lib/codeForm.ts`, `src/app/api/admin/referral-codes/**`, `src/app/api/admin/schools/options/route.ts`, `src/components/ui/MonthPicker.tsx`, `src/lib/readQrImage.ts`, `public/zxing_reader.wasm`, `tests/db/referralCodes.test.ts`

- [ ] Test DB: số lượt tháng lấy từ `referral_code_months`, chưa có dòng thì lấy `monthly_quota`. Sửa số lượt đổi dòng tháng đang chạy, giữ tháng đã qua. Đếm hoàn thành, đang giữ, không đạt đúng trạng thái. Nhân viên chỉ thấy mã của ngân hàng mình quản.
- [ ] Bảng: Ngân hàng, Tên hiển thị, Ưu tiên, Đã dùng, Hoàn thành, Đang giữ, Không đạt, Trường áp dụng, Trạng thái, Người tạo, Thao tác. Ô chọn tháng trên TopBar. Lọc theo từ khoá, ngân hàng, ẩn mã đã ngừng.
- [ ] Hộp thoại: Ngân hàng, Tên hiển thị, Ảnh QR, Mã text, Số lượt mỗi tháng, Độ ưu tiên, Trường dùng mã này.

## Task 5: Cài đặt (Trang 17)

**Files:** `src/server/settings.ts`, `src/app/api/admin/settings/route.ts`, `src/app/admin/(shell)/settings/page.tsx`, `tests/db/settings.test.ts`

- [ ] Test DB: lưu và đọc lại mẫu SMS, link QR Zalo, link app PVI. Ghi `audit_log`.
- [ ] Trang: Mẫu SMS có đếm ký tự theo dữ liệu mẫu, QR kết bạn Zalo, QR tới app PVI.

## Task 6: Test e2e

**Files:** `e2e/config.spec.ts`

- [ ] Quản trị tạo trường, tạo ngân hàng có 2 khung ảnh, tạo mã gắn cho trường. Tab Kho mã hiện mã Còn chỗ 0/200.
- [ ] Nhân viên được giao một ngân hàng chỉ thấy ngân hàng đó.

## Kết quả review và việc để lại

Agent review cả nhánh ngày 2026-11-05: không có lỗi Critical, không có lỗ hổng phân quyền. Đã sửa:

| Lỗi | Test |
|---|---|
| MultiSelect: bấm Enter lúc chưa có kết quả thì form gửi đi; kết quả về muộn mở lại danh sách sau khi rời ô | e2e "bấm Enter trong ô tìm trường lúc chưa có kết quả thì không gửi form" |
| Hộp xác nhận có câu giải thích; thông báo lỗi xưng "Bạn" | `tests/unit/copy.test.ts` |
| Kiểm dung lượng ảnh sau khi đã đọc hết request | `tests/unit/upload.test.ts` |
| Khoá ảnh lưu vào DB chưa kiểm dạng và thư mục; `qrKey` rỗng qua được | `tests/unit/forms.test.ts` |
| Ảnh mẫu và ảnh QR nhận HEIC, Chrome và Android không hiện được | `tests/unit/forms.test.ts` "không nhận HEIC" |
| `QrPreview` dùng effect cho giá trị suy ra được; nay vẽ SVG lúc render | e2e "Cài đặt vẽ QR ngay khi gõ link Zalo" |

Không sửa: agent đề nghị bỏ chữ "học sinh" trên trang quản lý. Chủ dự án chốt 2026-11-04 chữ trên màn hình vẫn ghi học sinh.

Việc để lại:

| Việc | Khi nào |
|---|---|
| Combobox: focus vào ô làm mất tên xã đang hiện; mục đang chọn không cuộn vào tầm nhìn; lỗi chưa gắn `aria-describedby`. MultiSelect chưa có chỗ báo lỗi | Khi sửa form |
| Hộp thoại mã: sửa mã của ngân hàng đã tắt hiện sai tên ngân hàng; đọc QR mới lỗi thì giữ link cũ; wasm lỗi thì ô ảnh đứng mãi ở "Đang tải ảnh"; chưa có nút bỏ ảnh QR | Khi sửa Kho mã |
| Tìm kiếm phân biệt dấu ("nguyen du" không ra "Nguyễn Du"); chưa thoát `%` `_` | Giai đoạn 5 cùng ô tìm hồ sơ |
| `listCodes` sắp xếp chưa có `id` cuối, phân trang có thể lặp hoặc sót dòng | Khi sửa Kho mã |
| Trùng `banks.code` hoặc tên hiển thị cùng lúc trả 500; `schoolIds`, `bankId` không tồn tại trả 500; nhận cả trường đã đóng | Khi sửa form |
| Ba hàm `set*Active` ghi `audit_log` ngoài transaction | Khi sửa các hàm này |
| Matcher của proxy bỏ qua mọi đường dẫn có đuôi ảnh, kể cả `/admin/...x.png` | Giai đoạn 4 khi thêm route học sinh |
| Route đọc ảnh mở cho mọi người đăng nhập; giai đoạn 4 thêm thư mục ảnh học sinh thì phải kiểm quyền theo ngân hàng | Giai đoạn 4 |
| Comment chép từ mgst-app trong `readQrImage.ts` còn nhắc CCCD, spec §4.4b | Khi sửa file này |
| Mẫu SMS nhận cả biến không có thật như `{HOTEN}` | Giai đoạn 5 |
| Danh sách người quản giữ cả người đã khoá, sửa ngân hàng báo lỗi tới khi bỏ người đó | Khi sửa Ngân hàng |
