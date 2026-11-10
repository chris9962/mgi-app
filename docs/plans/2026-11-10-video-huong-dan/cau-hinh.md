# Rà e2e và video: đăng nhập và cấu hình ở trang quản lý

Ngày rà: 2026-11-10. Repo: `mgi-bank`. Phạm vi: admin.localhost:3100.

Kết luận nhanh:
- Nhóm này có 36 tính năng và 312 ca. 71 ca chưa có e2e. Số đếm chi tiết nằm ở mục 6.
- Ca chưa có e2e tập trung ở bốn chỗ: logo ngân hàng, các nút "mở lại" (Mở lại trường, Bật lại ngân hàng, Dùng lại mã, mở khoá Đã khoá), lưu sau khi Sửa (trường, mã), và các trạng thái trống.
- Video 03 thiếu logo ngân hàng (commit 4493a2d). Chưa có video nào cho nhân viên hậu kiểm được giao ngân hàng.
- Mọi video trong phạm vi đều lộ chữ "ZZE2E", "E2E …" hoặc `zz_e2e_*`. Chi tiết ở mục 5.

## 0. Quy ước

- Vai: **QT** = Quản trị (admin). **QL** = Manager. **NV** = Nhân viên (staff). **NV giao** = Nhân viên được giao ít nhất một ngân hàng (nhân viên hậu kiểm).
- Quyền của NV: `manage_banks` (Quản lý ngân hàng), `export_excel`, `schools` (Trường và QR), `vouchers`.
- QT làm được mọi việc. QL làm được mọi việc trừ "system" (Cài đặt, Vận hành hệ thống).
- Trang thiếu quyền trả 404 (`requirePage` gọi `notFound()`). Chưa đăng nhập thì về `/login`.
- API sai Origin trả 403. API không có phiên trả 401. API thiếu quyền trả 403.
- Mã test: `tên-file#n` là test thứ n trong file `e2e/<tên-file>.spec.ts`. Danh sách ở mục 3.
- Mã video: `F03/b2` là bước 2 của `e2e/flows/03-cau-hinh.spec.ts`. Flow cũng là test Playwright có `expect`, nên mình tính flow là có e2e.
- Cột E2E ghi **chưa có** khi không spec nào và không flow nào kiểm ca đó. Ghi **một phần** khi chỉ kiểm được một nửa ca. Ghi "có test DB" khi `tests/db` có kiểm nhưng trình duyệt chưa kiểm.
- Cột Đề xuất:
  - **Video**: ca lớn, đã có trong video.
  - **Video (thiếu)**: ca lớn, phải thêm vào video.
  - **E2E**: ca nhỏ, chỉ cần e2e.

## 1. Tính năng và vai

| # | Tính năng | Trang, route | QT | QL | NV | Ai bị chặn, chặn thế nào |
|---|---|---|---|---|---|---|
| F1 | Đăng nhập | `/login`, `POST /api/admin/login` | có | có | có | Tài khoản Đã khoá: báo "Tên đăng nhập hoặc mật khẩu không đúng." |
| F2 | Khoá do sai mật khẩu | `/login`; mở khoá ở `/users` | có | có | có | Sai 5 lần: khoá 15 phút (423). QL không mở khoá được tài khoản QT (403). |
| F3 | Đăng xuất | menu tài khoản, `POST /api/admin/logout` | có | có | có | Không ai bị chặn. |
| F4 | Phiên và chuyển trang | `/`, mọi trang quản lý | có | có | có | Không có phiên: về `/login`. Đường dẫn lạ: 404. |
| F5 | Cá nhân: xem | `/profile` | có | có | có | Không ai bị chặn. |
| F6 | Sửa thông tin cá nhân | `/profile`, `PATCH /api/admin/profile` | có | có | có | Không ai bị chặn. |
| F7 | Đổi mật khẩu | `/profile`, `POST /api/admin/profile/password` | có | có | có | Sai mật khẩu hiện tại 5 lần: khoá như đăng nhập. |
| F8 | Tài khoản: danh sách, tìm | `/users` | có | có | không | NV: menu ẩn, trang 404, API 403. |
| F9 | Thêm tài khoản | `/users`, `POST /api/admin/users` | có | có (trừ vai QT) | không | QL: danh sách vai không có Quản trị, API tạo QT 403. NV: 403. |
| F10 | Sửa tài khoản | `/users`, `/users/[id]` | có | có (trừ tài khoản QT) | không | QL sửa QT: 403. Tự đổi vai mình: 400. |
| F11 | Khoá, mở khoá tài khoản | `/users`, `/users/[id]` | có | có (trừ QT) | không | Dòng của chính mình: nút ẩn, API 400. |
| F12 | Đặt lại mật khẩu | `/users/[id]` | có | có (trừ QT) | không | Trang của chính mình: nút ẩn, API 400. |
| F13 | Chi tiết tài khoản | `/users/[id]` | có | có | không | NV: 404. Id sai: 404. |
| F14 | Trường: danh sách, tìm | `/schools` | có | có | có quyền `schools` | NV khác: menu ẩn, trang 404. |
| F15 | Thêm, sửa trường | `/schools`, `/api/admin/schools`, `/api/admin/wards` | có | có | có quyền `schools` | NV khác: API 403. |
| F16 | Đóng, mở lại trường | `/schools` | có | có | có quyền `schools` | Như F15. |
| F17 | Chép link, tải QR của trường | `/schools`, `/api/admin/schools/[id]/qr` | có | có | có quyền `schools` | Như F15. |
| F18 | Xuất Excel trường | `/schools` | có | có | có `schools` và `export_excel` | Thiếu `export_excel`: nút ẩn. Thiếu `schools`: 404. |
| F19 | Ngân hàng: danh sách | `/banks` | có | có | `manage_banks` (mọi ngân hàng) hoặc NV giao (ngân hàng mình) | NV khác: menu ẩn, 404. NV giao: chỉ thấy ngân hàng mình. |
| F20 | Thêm, sửa ngân hàng | `/banks`, `/api/admin/banks` | có | có | Thêm: chỉ `manage_banks`. Sửa: cả NV giao | NV giao: nút Thêm ẩn, API tạo 403. Ngân hàng ngoài phạm vi: 404. |
| F21 | Người quản ngân hàng | hộp Thêm, Sửa ngân hàng | có | có | chỉ `manage_banks` | NV giao: ô người quản ẩn, server bỏ qua `managerIds`. |
| F22 | Logo ngân hàng | hộp Thêm, Sửa ngân hàng, `/api/admin/uploads?folder=logos` | có | có | như F20 | Như F20. |
| F23 | Tắt, bật lại ngân hàng | `/banks` | có | có | như F20 (sửa) | Ngân hàng ngoài phạm vi: 404. |
| F24 | Hướng dẫn mở tài khoản, khung ảnh, ảnh mẫu | `/banks` nút Hướng dẫn | có | có | như F20 (sửa) | Ngân hàng ngoài phạm vi: 404. |
| F25 | Kho mã: danh sách, lọc, tìm | `/banks/codes` | có | có | `manage_banks` hoặc NV giao | NV khác: menu ẩn, 404. NV giao: chỉ mã ngân hàng mình. |
| F26 | Kho mã theo tháng | `/banks/codes?month=` | có | có | như F25 | Như F25. |
| F27 | Thêm, sửa mã giới thiệu | `/banks/codes`, `/api/admin/referral-codes` | có | có | như F25 | Không có ngân hàng đang bật: nút Thêm mã khoá. Ngân hàng ngoài phạm vi: 404. |
| F28 | Ngừng, dùng lại mã | `/banks/codes` | có | có | như F25 | Mã ngoài phạm vi: 404. |
| F29 | Cài đặt mẫu SMS | `/settings` | có | không | không | QL, NV: menu ẩn, 404, API 403 "Chỉ Quản trị sửa được cài đặt." |
| F30 | Link Zalo, link app PVI | `/settings` | có | không | không | Như F29. |
| F31 | Vận hành hệ thống | `/ops` | có | không | không | QL, NV: menu ẩn, 404. |
| F32 | Sidebar, menu theo quyền | mọi trang | có | có | có | Mục không có quyền: ẩn. |
| F33 | Menu tài khoản, giao diện sáng tối | nút tài khoản ở sidebar | có | có | có | Không ai bị chặn. |
| F34 | Điện thoại: thanh đáy, sidebar trượt | mọi trang, khổ dưới 900 px | có | có | có | NV không có trang nghiệp vụ: thanh đáy chỉ có nút Thêm. |
| F35 | Tải ảnh lên, xem ảnh | `/api/admin/uploads`, `/api/admin/images` | có | có | Tải: `manage_banks` hoặc NV giao. Xem: mọi phiên | Tải: 403. Xem không phiên: 401. Key lạ: 404. |
| F36 | Luật chung của API quản lý | `/api/admin/**` | có | có | có | Origin lạ 403, không phiên 401, body sai 400. |

## 2. Ca theo tính năng

### F1. Đăng nhập

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 1.1 | QT đăng nhập đúng, vào `/users`. | auth#6, edge-config-shell#3 | F01/b3 | Video |
| 1.2 | NV đăng nhập đúng, vào `/profile`. | edge-config-shell#3 | F02/b3 | Video |
| 1.3 | Bỏ trống tên hoặc mật khẩu: "Nhập tên đăng nhập và mật khẩu." | edge-config-login#1 | chưa có | E2E |
| 1.4 | Tên lạ, tên rất dài, tên có ký tự lạ: "Tên đăng nhập hoặc mật khẩu không đúng." | edge-config-login#1 | chưa có | E2E |
| 1.5 | Điện thoại tự viết hoa chữ đầu, thêm dấu cách: vẫn đăng nhập được. | edge-config-login#2 | chưa có | E2E |
| 1.6 | Sai mật khẩu lần 1, 2: chỉ báo lỗi chung, chưa hiện hộp nhắc. | auth#1 | F01/b1 | Video |
| 1.7 | Tài khoản Đã khoá đăng nhập đúng mật khẩu: báo "không đúng", không lộ trạng thái khoá. | edge-config-login#4 | chưa có | E2E |
| 1.8 | Bấm đúp nút Đăng nhập: gửi một lần, nút hiện "Đang kiểm tra…". | edge-config-login#3 | chưa có | E2E |
| 1.9 | Mất mạng: "Không đăng nhập được. Kiểm tra kết nối mạng rồi thử lại." | edge-config-login#3 | chưa có | E2E |
| 1.10 | Máy chủ lỗi 500: "Không đăng nhập được. Thử lại sau ít phút." | **chưa có** | chưa có | E2E |
| 1.11 | Bấm nút hiện, ẩn mật khẩu. | **chưa có** | chưa có | Video (thiếu) |
| 1.12 | Đã đăng nhập mà mở `/login`: chuyển vào trang chính. | edge-config-login#5 | chưa có | E2E |
| 1.13 | API đăng nhập có Origin lạ: 403. | edge-config-login#5 | chưa có | E2E |
| 1.14 | API đăng nhập gửi body không phải JSON hoặc sai kiểu: 400. | edge-config-api#2 | chưa có | E2E |
| 1.15 | API đăng nhập thiếu trường `username` hoặc `password`: 400. | **chưa có** | chưa có | E2E |
| 1.16 | Tên có NUL hoặc ký tự điều khiển: đi vào bộ đếm ảo, trả lỗi chung. | edge-config-api#4, có test DB | chưa có | E2E |

### F2. Khoá do sai mật khẩu

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 2.1 | Sai lần 3 và 4: hộp "Sắp bị khoá", câu "Sai mật khẩu {n} lần rồi, 5 lần sẽ bị khoá tài khoản 15 phút." | auth#1 | F01/b1 | Video |
| 2.2 | Sai lần 5: "Sai 5 lần liên tiếp, tài khoản bị khoá 15 phút. Liên hệ quản trị để mở lại." | auth#1 | F01/b1 | Video |
| 2.3 | Đang khoá, nhập đúng mật khẩu vẫn bị chặn (423). | auth#1 | F01/b2 | Video |
| 2.4 | Hộp nhắc: focus vào nút "Đã hiểu", Esc đóng, focus về ô mật khẩu. | auth#3 | chưa có | E2E |
| 2.5 | Bộ đếm trên trình duyệt tính theo tên viết thường. | edge-config-login#2 | chưa có | E2E |
| 2.6 | Nhận `locked` thì bộ đếm trên trình duyệt về 0. | **một phần** auth#1 | chưa có | E2E |
| 2.7 | QT thấy tag "Khoá tạm" ở `/users`, bấm Mở khoá. | auth#2 | F01/b3, F01/b4 | Video |
| 2.8 | Sau khi mở khoá, NV đăng nhập lại được. | auth#2 | F01/b5 | Video |
| 2.9 | Hết 15 phút thì tự mở. | **chưa có** (có test DB) | chưa có | E2E |
| 2.10 | Đăng nhập đúng trước lần 5 thì bộ đếm về 0. | **chưa có** (có test DB) | chưa có | E2E |
| 2.11 | Tên không có thật hoặc tài khoản tắt: khoá ảo trong bộ nhớ, câu chữ giống tài khoản thật. | **chưa có** (có test DB) | chưa có | E2E |
| 2.12 | Nhiều lượt sai gửi song song vẫn đếm đúng. | **chưa có** (có test DB) | chưa có | E2E |
| 2.13 | QT đặt lại mật khẩu thì khoá tạm cũng mất. | **chưa có** | chưa có | E2E |

### F3. Đăng xuất

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 3.1 | Bấm Đăng xuất ở menu tài khoản, về `/login`. | edge-config-login#6 | F01/b4 (chỉ lướt cuối bước) | Video (thiếu): tách thành bước riêng |
| 3.2 | Hai tab: đăng xuất ở tab A, tab B bấm gì cũng về `/login`. | edge-config-login#6 | chưa có | E2E |
| 3.3 | Đăng xuất từ sidebar trượt trên điện thoại. | **chưa có** | chưa có | Video (thiếu) |

### F4. Phiên và chuyển trang

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 4.1 | Chưa đăng nhập mở trang quản lý: về `/login`. | edge-config-shell#3, edge-config-login#4 | chưa có | E2E |
| 4.2 | Mở `/`: QT, QL về `/users`; NV về `/profile`. | edge-config-shell#3 | chưa có | E2E |
| 4.3 | Đường dẫn không có: 404. | edge-config-shell#3 | chưa có | E2E |
| 4.4 | QT khoá tài khoản đang dùng: lần gọi API sau trả 401, về `/login`. | edge-config-login#4 | chưa có | E2E |
| 4.5 | QT bớt quyền giữa phiên: menu và trang đổi theo ngay. | edge-config-shell#5 | chưa có | E2E |
| 4.6 | Cookie hết hạn hoặc sai: về `/login`. | **chưa có** | chưa có | E2E |

### F5. Cá nhân: xem

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 5.1 | Xem họ tên, tên đăng nhập, vai, quyền, SĐT. | edge-config-profile#1 | F02/b4 (lướt) | Video |
| 5.2 | Họ tên 150 ký tự xuống hàng trong khung; họ tên có thẻ HTML hiện nguyên văn. | edge-config-profile#1 | chưa có | E2E |
| 5.3 | SĐT trống ghi "Chưa có". | edge-config-profile#1 | chưa có | E2E |

### F6. Sửa thông tin cá nhân

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 6.1 | Sửa họ tên, SĐT rồi lưu. | edge-config-profile#2 | chưa có | Video (thiếu) |
| 6.2 | Họ tên trống: báo lỗi ở ô. | edge-config-profile#2 | chưa có | E2E |
| 6.3 | SĐT không đủ 10 số hoặc không bắt đầu bằng 0: báo lỗi ở ô. | edge-config-profile#2 | chưa có | E2E |
| 6.4 | SĐT có dấu cách: lưu thành 10 số. SĐT trống: được lưu. | **một phần** edge-config-profile#2 (chưa kiểm SĐT trống) | chưa có | E2E |
| 6.5 | Mất mạng: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." | edge-config-profile#2 | chưa có | E2E |
| 6.6 | Máy chủ lỗi 500: nút khoá lúc lưu, báo "Không lưu được. Thử lại sau ít phút." | edge-business-dialogs#1 | chưa có | E2E |
| 6.7 | Huỷ rồi mở lại: không còn lỗi cũ. | edge-config-profile#2 | chưa có | E2E |
| 6.8 | API không có phiên 401, Origin lạ 403. | edge-config-profile#5 | chưa có | E2E |

### F7. Đổi mật khẩu

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 7.1 | Đổi đúng: hiện "Đã đổi", phiên đang dùng còn. | edge-config-profile#4 | F02/b4 | Video |
| 7.2 | Mật khẩu cũ hỏng, mật khẩu mới đăng nhập được. | edge-config-profile#4 | F02/b5 | Video |
| 7.3 | Bỏ trống ô: "Nhập mật khẩu hiện tại" và các ô khác. | edge-config-profile#2 | chưa có | E2E |
| 7.4 | Hai lần nhập mật khẩu mới khác nhau: "Hai lần nhập không giống nhau". | edge-config-profile#2 | chưa có | Video (thiếu) |
| 7.5 | Sai mật khẩu hiện tại: "Mật khẩu hiện tại không đúng." ở ô. | edge-config-profile#3 | chưa có | Video (thiếu) |
| 7.6 | Sai mật khẩu hiện tại 5 lần: khoá 15 phút, đăng nhập lại cũng bị khoá. | edge-config-profile#3 | chưa có | E2E |
| 7.7 | Phiên ở trình duyệt khác bị đăng xuất. | edge-config-profile#4 | chưa có | E2E |
| 7.8 | Mật khẩu mới có dấu cách đầu cuối: giữ nguyên. | edge-config-profile#4 | chưa có | E2E |
| 7.9 | Máy chủ lỗi 500: nút khoá lúc lưu, báo lỗi chung. | edge-business-dialogs#1 | chưa có | E2E |
| 7.10 | Huỷ rồi mở lại: ô trống, không còn lỗi cũ. | edge-config-profile#2 | chưa có | E2E |
| 7.11 | API không có phiên 401, Origin lạ 403. | edge-config-profile#5 | chưa có | E2E |

### F8. Tài khoản: danh sách, tìm

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 8.1 | Xem bảng tài khoản: họ tên, mã, vai, quyền, ngân hàng giao, trạng thái. | edge-config-users#1 | F01/b3 (lướt) | Video |
| 8.2 | Tìm theo tên không dấu. | edge-config-users#2 | F01/b3 (tìm theo tên đăng nhập) | Video |
| 8.3 | Tìm theo mã tài khoản. | **chưa có** | chưa có | E2E |
| 8.4 | Từ khoá có `%`, `_` hoặc chỉ dấu cách. | edge-config-users#2 | chưa có | E2E |
| 8.5 | Từ khoá nhiều từ, 100 ký tự. | edge-config-users#3 | chưa có | E2E |
| 8.6 | Không khớp: "Không có tài khoản khớp từ khoá." | edge-config-users#2 | chưa có | E2E |
| 8.7 | Phân trang 16 dòng; số trang sai. | edge-config-users#4 | chưa có | E2E |
| 8.8 | Tag trạng thái: "Đang hoạt động", "Khoá tạm", "Đã khoá". | auth#2, edge-config-users#10 | F01/b3 | Video |
| 8.9 | Tên rất dài, tên có HTML. | edge-config-users#1 | chưa có | E2E |
| 8.10 | NV mở `/users`: 404, menu không có mục Tài khoản. | auth#5, edge-config-shell#4 | chưa có | E2E |

### F9. Thêm tài khoản

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 9.1 | QT thêm NV có quyền, hộp hiện mật khẩu tạm. | auth#6 | F02/b1 | Video |
| 9.2 | Bấm "Chép" mật khẩu: nút đổi thành "Đã chép". | **chưa có** | chưa có | Video (thiếu) |
| 9.3 | Trình duyệt chặn clipboard: "Không chép được.", chữ được chọn sẵn. | auth#7 | chưa có | E2E |
| 9.4 | Thêm QL: nhóm Quyền ẩn. | **một phần** edge-config-users#7 | chưa có | Video (thiếu) |
| 9.5 | QL mở hộp Thêm: danh sách vai không có Quản trị. | edge-config-users#8 | chưa có | E2E |
| 9.6 | Lỗi form: ô trống, tên đăng nhập sai mẫu `^[a-z0-9._]{3,32}$`, viết hoa, SĐT sai. | edge-config-users#5 | chưa có | E2E |
| 9.7 | Trùng tên đăng nhập: 409 "Tên đăng nhập đã có." | edge-config-users#5 | chưa có | E2E |
| 9.8 | Trùng mã tài khoản: 409 "Mã tài khoản đã có." | edge-config-users#5 | chưa có | E2E |
| 9.9 | Mã tài khoản trống: lưu null, nhiều tài khoản cùng không có mã. | **chưa có** | chưa có | E2E |
| 9.10 | Ba lượt tạo cùng lúc, bấm đúp, Esc. | edge-config-users#6 | chưa có | E2E |
| 9.11 | Bấm Huỷ. | edge-config-users#5 | chưa có | E2E |
| 9.12 | Máy chủ lỗi 500 khi thêm: nút khoá, báo lỗi chung. | **chưa có** (edge-business-dialogs#1 chỉ kiểm hộp Sửa) | chưa có | E2E |
| 9.13 | QL gọi API tạo tài khoản QT: 403. | edge-config-users#8 | chưa có | E2E |
| 9.14 | NV gọi API tạo tài khoản: 403. | edge-config-users#8 | chưa có | E2E |

### F10. Sửa tài khoản

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 10.1 | QT sửa họ tên, quyền của NV rồi lưu. | **một phần** edge-config-users#7 | chưa có | Video (thiếu) |
| 10.2 | Đổi NV thành QL. | edge-config-users#7 | chưa có | E2E |
| 10.3 | Tự đổi vai của mình: 400 "Không tự đổi vai của chính mình." | edge-config-users#7 | chưa có | E2E |
| 10.4 | QL sửa tài khoản QT: 403 "Chỉ Quản trị thao tác được với tài khoản Quản trị." | edge-config-users#8 | chưa có | E2E |
| 10.5 | Sửa thành tên đăng nhập hoặc mã tài khoản đã có: 409. | **chưa có** | chưa có | E2E |
| 10.6 | Id sai: 404. | edge-config-users#4 | chưa có | E2E |
| 10.7 | Máy chủ lỗi 500: nút khoá lúc lưu, báo lỗi chung. | edge-business-dialogs#1 | chưa có | E2E |
| 10.8 | Bớt quyền: người đó thấy menu đổi ngay. | edge-config-shell#5 | chưa có | E2E |

### F11. Khoá, mở khoá tài khoản

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 11.1 | QT khoá NV qua hộp xác nhận: tag "Đã khoá", phiên của NV bị xoá. | edge-config-users#10, edge-config-login#4 | chưa có | Video (thiếu) |
| 11.2 | QT mở khoá tài khoản "Đã khoá". | **chưa có** | chưa có | Video (thiếu) |
| 11.3 | QT mở khoá tài khoản "Khoá tạm": xoá luôn hạn khoá. | auth#2 | F01/b4 | Video |
| 11.4 | Dòng của chính mình không có nút khoá; API trả 400 "Không tự khoá tài khoản của chính mình." | edge-config-users#9 | chưa có | E2E |
| 11.5 | QL khoá tài khoản QT: 403. | edge-config-users#8 | chưa có | E2E |
| 11.6 | Hai tab cùng khoá một tài khoản. | edge-config-users#10 | chưa có | E2E |
| 11.7 | Bấm Huỷ ở hộp xác nhận khoá. | **chưa có** | chưa có | E2E |

### F12. Đặt lại mật khẩu

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 12.1 | QT đặt lại mật khẩu cho NV, hộp hiện mật khẩu mới. | auth#6 | F02/b2 | Video |
| 12.2 | Mật khẩu cũ và phiên cũ của NV hết dùng được. | edge-config-users#10 | F02/b3 | Video |
| 12.3 | Trang của chính mình không có nút; API trả 400 "Không tự đặt lại mật khẩu của chính mình." | edge-config-users#9 | chưa có | E2E |
| 12.4 | QL đặt lại mật khẩu QT: 403. | edge-config-users#8 | chưa có | E2E |
| 12.5 | Đặt lại mật khẩu xoá khoá tạm (trùng 2.13). | **chưa có** | chưa có | E2E |
| 12.6 | Hộp xác nhận lỗi giữa chừng: nút mở lại, bấm lại được. | edge-business-dialogs#2 | chưa có | E2E |
| 12.7 | Clipboard bị chặn khi chép mật khẩu mới. | auth#7 | chưa có | E2E |

### F13. Chi tiết tài khoản

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 13.1 | Xem chi tiết: "Toàn quyền", "Chưa cấp quyền nào.", "Mọi ngân hàng", "Chưa giao", "Chưa có". | **một phần** edge-config-users#1, #9 | F02/b2 (lướt) | Video |
| 13.2 | Id sai: 404. | edge-config-users#4 | chưa có | E2E |
| 13.3 | Trang của chính mình: không có nút Khoá, Đặt lại mật khẩu. | edge-config-users#9 | chưa có | E2E |

### F14. Trường: danh sách, tìm

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 14.1 | Xem bảng trường. | edge-config-schools#1 | F03/b1 (lướt), F11/b6 | Video |
| 14.2 | Tìm không dấu, có `%`, `_`. | edge-config-schools#3 | chưa có | Video (thiếu) |
| 14.3 | Tìm nhiều từ. | edge-config-schools#4 | chưa có | E2E |
| 14.4 | Không khớp: "Không có trường khớp từ khoá." | edge-config-schools#3 | chưa có | E2E |
| 14.5 | Chưa có trường: "Chưa có trường nào." | **chưa có** | chưa có | E2E |
| 14.6 | Phân trang, số trang sai, nút quay lại; trường vừa đóng xuống cuối. | edge-config-schools#5 | chưa có | E2E |
| 14.7 | Tên rất dài, ký tự đặc biệt; hộp thoại vừa màn hình. | edge-config-schools#1, #2 | chưa có | E2E |
| 14.8 | NV không có quyền `schools`: menu ẩn, 404. | edge-config-schools#10, edge-config-shell#4 | chưa có | E2E |

### F15. Thêm, sửa trường

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 15.1 | Thêm trường: chọn tỉnh, tìm xã, lưu. | config#1 | F03/b1 | Video |
| 15.2 | Ô xã khoá tới khi chọn tỉnh. | edge-config-schools#6 | F03/b1 | Video |
| 15.3 | Enter trong ô xã chọn đúng dòng đang sáng. | config#3 | chưa có | E2E |
| 15.4 | Gõ xã không có: "Không có kết quả". | **chưa có** | chưa có | E2E |
| 15.5 | Lỗi form: tên trống, thiếu tỉnh hoặc xã, SĐT sai. | edge-config-schools#6 | chưa có | E2E |
| 15.6 | SĐT có dấu cách, dấu chấm: tự bỏ. | edge-config-schools#7 | chưa có | E2E |
| 15.7 | API gửi xã không thuộc tỉnh: 400 "Xã/phường không thuộc tỉnh đã chọn." ở ô xã. | edge-config-schools#8 | chưa có | E2E |
| 15.8 | Không tải được danh sách xã: "Không tải được danh sách xã/phường." | **chưa có** | chưa có | E2E |
| 15.9 | `/api/admin/wards` với tỉnh sai: trả `[]`. | edge-config-api#3 | chưa có | E2E |
| 15.10 | Trùng tên trường: được phép. | edge-config-schools#8 | chưa có | E2E |
| 15.11 | Sửa trường rồi lưu. | **chưa có** | chưa có | Video (thiếu) |
| 15.12 | Sửa rồi Huỷ: giữ giá trị cũ. | edge-config-schools#8 | chưa có | E2E |
| 15.13 | Enter, bấm đúp: gửi một lần. | edge-config-schools#8 | chưa có | E2E |
| 15.14 | Máy chủ lỗi 500 ở hộp Sửa trường: nút khoá, báo lỗi chung. | edge-business-dialogs#1 | chưa có | E2E |
| 15.15 | Id sai: 404 "Không tìm thấy trường." | edge-config-schools#9 | chưa có | E2E |

### F16. Đóng, mở lại trường

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 16.1 | Đóng trường qua hộp xác nhận. | edge-config-schools#5, #11 | chưa có | Video (thiếu) |
| 16.2 | Mở lại trường đã đóng. | **chưa có** | chưa có | Video (thiếu) |
| 16.3 | Hai tab cùng đóng một trường. | edge-config-schools#11 | chưa có | E2E |
| 16.4 | Trường đã đóng không gắn được vào mã (xem 27.14). | edge-config-codes#15 | chưa có | E2E |

### F17. Chép link, tải QR của trường

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 17.1 | Chép link trường: "Đã chép link". | flow F03/b2, F11/b6 | F03/b2, F11/b6 | Video |
| 17.2 | Clipboard bị chặn: "Không chép được". | edge-config-schools#13 | chưa có | E2E |
| 17.3 | Tải ảnh QR, tên file `qr-<tên không dấu>.png`. | edge-config-schools#13 | F03/b2 | Video |
| 17.4 | Link vừa chép mở đúng web học sinh. | flow F11/b6 | F11/b6 | Video |

### F18. Xuất Excel trường

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 18.1 | Có `export_excel`: bấm Xuất Excel, file đúng cột. | edge-config-schools#12 | F09 (nhóm khác) | Video (ở F09) |
| 18.2 | Không có `export_excel`: nút ẩn. | edge-config-schools#9 | chưa có | E2E |
| 18.3 | Có `export_excel` mà thiếu `schools`: 404. | edge-config-schools#10 | chưa có | E2E |
| 18.4 | Lỗi xuất Excel trên điện thoại vừa màn hình. | mobile#20 | chưa có | E2E |

### F19. Ngân hàng: danh sách

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 19.1 | Xem các cột: Mã ngân hàng, Tên kèm logo, Ưu tiên, Ảnh cần nộp, Mã còn chỗ, Người quản, Trạng thái, Thao tác. | edge-config-banks#1 | F03/b3 (lướt, không giải thích cột) | Video (thiếu) |
| 19.2 | Ngân hàng mới: "Chưa cài" ảnh, "Chưa giao" người quản. | edge-config-banks#10 | chưa có | E2E |
| 19.3 | Ngân hàng không có logo: ô viền đứt. | **chưa có** | chưa có | E2E |
| 19.4 | Chưa có ngân hàng: "Chưa có ngân hàng nào." | **chưa có** | chưa có | E2E |
| 19.5 | NV giao chỉ thấy ngân hàng của mình. | config#2, edge-config-banks#7 | chưa có | Video (thiếu) |
| 19.6 | NV không có quyền: menu ẩn, 404. | edge-config-shell#4 | chưa có | E2E |
| 19.7 | Nút "Thêm ngân hàng" chỉ hiện khi có `manage_banks`. | edge-config-banks#7 | chưa có | E2E |

### F20. Thêm, sửa ngân hàng

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 20.1 | Thêm ngân hàng: mã, tên, ưu tiên. | config#1 | F03/b3 | Video |
| 20.2 | Lỗi form: mã sai mẫu `^[A-Z0-9]{2,10}$` (tự viết hoa), ưu tiên ngoài 0..999, tên trống. | edge-config-banks#2 | chưa có | E2E |
| 20.3 | Trùng mã: 409. Ba lượt tạo cùng mã một lúc. | edge-config-banks#4 | chưa có | E2E |
| 20.4 | NV không có `manage_banks` gọi API tạo: 403 "Không có quyền tạo ngân hàng." | edge-config-banks#7 | chưa có | E2E |
| 20.5 | QT sửa tên, ưu tiên rồi lưu. | **một phần** edge-config-banks#7 (NV giao sửa) | chưa có | Video (thiếu) |
| 20.6 | NV giao sửa ngân hàng của mình, không thấy ô người quản. | edge-config-banks#7 | chưa có | Video (thiếu) |
| 20.7 | NV sửa ngân hàng không được giao: 404. | edge-config-banks#7 | chưa có | E2E |
| 20.8 | Máy chủ lỗi 500: nút khoá lúc lưu, báo lỗi chung. | edge-config-banks#14 | chưa có | E2E |
| 20.9 | Tên dài, tên có HTML; hộp vừa màn hình. | edge-config-banks#1 | chưa có | E2E |

### F21. Người quản ngân hàng

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 21.1 | Giao người quản khi tạo ngân hàng. | config#1 | F03/b3 | Video |
| 21.2 | Tìm người quản bằng nhiều từ. | edge-config-banks#3 | chưa có | E2E |
| 21.3 | Tìm người quản bằng mã tài khoản. | **chưa có** | chưa có | Video (thiếu) |
| 21.4 | Danh sách chỉ có NV đang hoạt động, tối đa 20 dòng. | **chưa có** | chưa có | E2E |
| 21.5 | Gỡ người quản (bấm x ở chip) rồi lưu. | **chưa có** | chưa có | Video (thiếu) |
| 21.6 | Người quản đã bị khoá vẫn được giữ khi sửa. Thêm người bị khoá: 400 "Người quản phải là Nhân viên đang hoạt động." | edge-config-banks#5 | chưa có | E2E |
| 21.7 | Lỗi máy chủ gắn vào ô người quản. | edge-config-banks#6 | chưa có | E2E |
| 21.8 | Hơn 50 người quản: 400. | **chưa có** | chưa có | E2E |
| 21.9 | NV giao gửi `managerIds` qua API: server bỏ qua. | **một phần** edge-config-banks#7 | chưa có | E2E |

### F22. Logo ngân hàng (commit 4493a2d)

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 22.1 | Bấm "Chọn logo" khi tạo; bảng hiện logo. | edge-config-banks#15 | chưa có (F03/b3 không có logo) | Video (thiếu) |
| 22.2 | Mở Sửa: hộp hiện logo hiện tại, nút đổi thành "Đổi logo". | edge-config-banks#15 | chưa có | Video (thiếu) |
| 22.3 | Đổi sang logo khác rồi lưu. | **chưa có** | chưa có | Video (thiếu) |
| 22.4 | Ảnh trên 20 MB: "Ảnh lớn hơn 20 MB.", không gửi lên. | edge-config-banks#15 | chưa có | E2E |
| 22.5 | Máy chủ trả 413: "Ảnh lớn hơn 20 MB." | **chưa có** | chưa có | E2E |
| 22.6 | File không phải ảnh: "Chỉ nhận ảnh jpg, png, webp hoặc heic." | **chưa có** | chưa có | E2E |
| 22.7 | Ảnh hỏng: "Không mở được ảnh này. Chọn ảnh khác." | **chưa có** | chưa có | E2E |
| 22.8 | Đang tải: nút hiện "Đang tải ảnh…", nút Lưu khoá. | **chưa có** | chưa có | E2E |
| 22.9 | Mất mạng hoặc lỗi khác: "Không tải được logo." | **chưa có** | chưa có | E2E |
| 22.10 | Logo HEIC: server đổi sang webp, bảng hiện đúng. | **chưa có** | chưa có | E2E |
| 22.11 | API gửi `logoKey` sai thư mục: 400 "Logo không hợp lệ". | **chưa có** (có test DB) | chưa có | E2E |
| 22.12 | API gửi `logoKey: null`: bỏ logo. Giao diện không có nút bỏ logo. | **chưa có** | chưa có | E2E |
| 22.13 | NV giao đổi logo ngân hàng của mình. | **chưa có** | chưa có | Video (thiếu) |
| 22.14 | Huỷ hộp chọn file logo: không đổi gì. | **chưa có** | chưa có | E2E |

### F23. Tắt, bật lại ngân hàng

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 23.1 | Bấm Tắt, xác nhận: trạng thái "Đã tắt". | **chưa có** | chưa có | Video (thiếu) |
| 23.2 | Mở hộp Tắt rồi Huỷ. | edge-config-banks#1 | chưa có | E2E |
| 23.3 | Bấm "Bật lại": trạng thái "Đang triển khai". | **chưa có** | chưa có | Video (thiếu) |
| 23.4 | Ngân hàng đã tắt: không chọn được khi thêm mã; mở Sửa mã của ngân hàng đó. | edge-config-codes#17, #18 | chưa có | E2E |
| 23.5 | NV tắt ngân hàng không được giao: 404. | edge-config-banks#7 | chưa có | E2E |
| 23.6 | NV giao tắt ngân hàng của mình. | **chưa có** | chưa có | E2E |

### F24. Hướng dẫn mở tài khoản, khung ảnh, ảnh mẫu

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 24.1 | Nhập các bước, 2 khung ảnh có ảnh mẫu, lưu. | config#1 | F03/b4 | Video |
| 24.2 | Ngân hàng mới: hộp có sẵn 1 khung, tick sẵn Họ tên và Mã giới thiệu. | edge-config-banks#10 | chưa có | E2E |
| 24.3 | Bật, tắt ô "Kiểm trên ảnh" Họ tên và Mã giới thiệu. | **chưa có** | chưa có | Video (thiếu) |
| 24.4 | Bấm "Bỏ <tên>" để bỏ khung ảnh rồi lưu. | edge-config-banks#8 | chưa có | Video (thiếu) |
| 24.5 | Dòng bước bắt đầu bằng "1." hoặc "2)": tự bỏ số. | edge-config-banks#10 | chưa có | E2E |
| 24.6 | Ký tự tab trong bước đổi thành dấu cách. | edge-config-api#4 | chưa có | E2E |
| 24.7 | Lỗi: hơn 20 bước "Tối đa 20 bước"; 0 khung "Cần ít nhất 1 ảnh cần nộp"; hơn 10 khung "Tối đa 10 ảnh"; tên ảnh trống "Nhập tên ảnh". | edge-config-banks#10 | chưa có | E2E |
| 24.8 | Ảnh mẫu không phải ảnh. | edge-config-banks#10 | chưa có | E2E |
| 24.9 | Ảnh mẫu 23 MB; máy chủ trả 413. | edge-config-banks#11 | chưa có | E2E |
| 24.10 | Đang tải ảnh mẫu: mọi nút ảnh mẫu và nút Lưu khoá. | edge-config-banks#12 | chưa có | E2E |
| 24.11 | Huỷ hộp chọn file ảnh mẫu. | edge-config-banks#13 | chưa có | E2E |
| 24.12 | Hai tab: tab sau lưu bị 409 "Hướng dẫn đã có người sửa. Mở lại để xem bản mới." | edge-config-banks#8, #9 | chưa có | E2E |
| 24.13 | API gửi khung ảnh không thuộc ngân hàng: 400 "Khung ảnh không thuộc ngân hàng này." | **chưa có** | chưa có | E2E |
| 24.14 | Không tải được hướng dẫn: "Không tải được hướng dẫn." | **chưa có** | chưa có | E2E |
| 24.15 | Máy chủ lỗi 500: nút khoá lúc lưu, báo lỗi chung. | edge-config-banks#14 | chưa có | E2E |
| 24.16 | NV giao sửa hướng dẫn ngân hàng của mình trên giao diện. | **chưa có** | chưa có | Video (thiếu) |

### F25. Kho mã: danh sách, lọc, tìm

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 25.1 | Xem bảng mã: tên hiển thị, ngân hàng, trường, chỉ tiêu tháng, đã dùng, trạng thái. | edge-config-codes#1 | F03/b6 (lướt, không giải thích cột) | Video (thiếu) |
| 25.2 | Chọn ngân hàng là lọc ngay, không có nút Lọc. | edge-config-codes#7 | F03/b6 | Video |
| 25.3 | Tìm theo tên, từ khoá có `%`, `_`. | edge-config-codes#2 | chưa có | Video (thiếu) |
| 25.4 | Tìm nhiều từ, 100 ký tự. | edge-config-codes#3 | chưa có | E2E |
| 25.5 | Gõ 6 ký tự: URL đổi một lần sau 300 ms; rời trang trước 300 ms. | edge-config-codes#4 | chưa có | E2E |
| 25.6 | Mạng chậm. | edge-config-codes#5 | chưa có | E2E |
| 25.7 | Tick "Ẩn mã đã ngừng", kể cả khi đang ở trang 2. | edge-config-codes#8 | chưa có | Video (thiếu) |
| 25.8 | Lọc kết hợp; phân trang 16 dòng. | edge-config-codes#7 | chưa có | E2E |
| 25.9 | Tham số URL sai. | edge-config-codes#9 | chưa có | E2E |
| 25.10 | Nút quay lại khôi phục bộ lọc. | edge-config-codes#10 | chưa có | E2E |
| 25.11 | Không khớp: "Không có mã khớp bộ lọc." | edge-config-codes#16 | chưa có | E2E |
| 25.12 | Chưa có mã: "Chưa có mã giới thiệu nào." | **chưa có** | chưa có | E2E |
| 25.13 | Tag trạng thái "Còn chỗ", "Hết chỗ", "Đã ngừng". | **một phần** edge-config-codes#8 (thiếu "Hết chỗ") | chưa có | Video (thiếu) |
| 25.14 | NV giao chỉ thấy mã ngân hàng mình; mở ngân hàng khác qua URL: 404. | config#2, edge-config-codes#16 | chưa có | Video (thiếu) |
| 25.15 | Tên mã rất dài. | edge-config-codes#1 | chưa có | E2E |

### F26. Kho mã theo tháng

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 26.1 | Bấm "Tháng trước" rồi về tháng này. | edge-config-codes#6 | F03/b7 | Video |
| 26.2 | Bấm "Tháng sau" trước khi hết 300 ms gõ tìm. | edge-config-codes#6 | chưa có | E2E |
| 26.3 | Qua năm: 12/2026 sang 01/2027. | edge-config-codes#11 | chưa có | E2E |
| 26.4 | Tháng trước năm 1900. | edge-config-codes#12 | chưa có | E2E |
| 26.5 | Sửa chỉ tiêu chỉ đổi tháng hiện tại; tháng cũ giữ số cũ. | **chưa có** (có test DB) | chưa có | Video (thiếu) |

### F27. Thêm, sửa mã giới thiệu

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 27.1 | Thêm mã có ảnh QR: đọc QR ra link, gắn trường, lưu. | config#1 | F03/b5 | Video |
| 27.2 | Lỗi form: thiếu cả mã text lẫn QR "Nhập mã text hoặc chọn ảnh QR"; link không phải http(s); chỉ tiêu ngoài 1..100000; ưu tiên ngoài 0..999. | edge-config-codes#13 | chưa có | E2E |
| 27.3 | Link có dấu cách; chọn file chữ làm ảnh QR. | edge-config-codes#19 | chưa có | E2E |
| 27.4 | Ảnh QR không chứa link: "QR không chứa link mở tài khoản." | **chưa có** | chưa có | E2E |
| 27.5 | Ảnh không có QR: "Không đọc được mã QR trong ảnh. Chụp lại rõ hơn, hoặc dán link bằng tay." | **chưa có** | chưa có | E2E |
| 27.6 | Ảnh QR 23 MB; máy chủ trả 413. | edge-config-codes#20 | chưa có | E2E |
| 27.7 | Đang tải ảnh QR: nút khoá. | edge-config-codes#21 | chưa có | E2E |
| 27.8 | Huỷ hộp chọn file. | edge-config-codes#22 | chưa có | E2E |
| 27.9 | Trùng tên hiển thị trong một ngân hàng: 409 "Tên hiển thị đã có trong ngân hàng này." Ba lượt cùng lúc. | edge-config-codes#14 | chưa có | E2E |
| 27.10 | Ngân hàng không có hoặc ngoài phạm vi: 404 "Không tìm thấy ngân hàng." ở ô ngân hàng. | edge-config-codes#15, #16 | chưa có | E2E |
| 27.11 | Ngân hàng vừa bị tắt: 400 "Ngân hàng đã tắt." | edge-config-codes#18 | chưa có | E2E |
| 27.12 | Trường đã đóng hoặc không còn: 400 "Có trường đã đóng hoặc không còn." | edge-config-codes#15 | chưa có | E2E |
| 27.13 | Hơn 500 trường: 400. | **chưa có** | chưa có | E2E |
| 27.14 | Không có ngân hàng nào đang bật: nút "Thêm mã" khoá. | **chưa có** | chưa có | E2E |
| 27.15 | Sửa mã: ô ngân hàng khoá; đổi chỉ tiêu rồi lưu. | **chưa có** | chưa có | Video (thiếu) |
| 27.16 | Sửa mã đang gắn trường đã đóng. | edge-config-codes#15 | chưa có | E2E |
| 27.17 | Sửa mã của ngân hàng đã tắt. | edge-config-codes#17 | chưa có | E2E |
| 27.18 | Gỡ trường khỏi mã (bấm x ở chip) rồi lưu. | **chưa có** | chưa có | Video (thiếu) |
| 27.19 | Lỗi máy chủ gắn vào ô trường. | edge-config-codes#15 | chưa có | E2E |
| 27.20 | Máy chủ lỗi 500: nút khoá lúc lưu, báo lỗi chung. | edge-config-codes#23 | chưa có | E2E |
| 27.21 | NV giao thêm mã cho ngân hàng của mình; ô ngân hàng chỉ có ngân hàng mình. | **một phần** config#2 | chưa có | Video (thiếu) |
| 27.22 | Giao diện không có nút bỏ ảnh QR đã chọn. | **chưa có** | chưa có | E2E |

### F28. Ngừng, dùng lại mã

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 28.1 | Bấm "Ngừng": tag "Đã ngừng". | edge-config-codes#8 | chưa có | Video (thiếu) |
| 28.2 | Bấm "Dùng lại". | **chưa có** | chưa có | Video (thiếu) |
| 28.3 | Mã ngoài phạm vi: 404. | edge-config-codes#16 | chưa có | E2E |

### F29. Cài đặt mẫu SMS

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 29.1 | Bấm thêm biến vào mẫu, xem trước số ký tự. | flow F08/b1 | F08/b1 | Video |
| 29.2 | Lưu, tải lại trang vẫn giữ giá trị mới: "Đã lưu cấu hình." | flow F08/b3 | F08/b3 | Video |
| 29.3 | Mẫu có dấu: "Mẫu SMS viết không dấu". | edge-config-settings#1 | chưa có | Video (thiếu) |
| 29.4 | Mẫu trống, nhiều dòng, có ký tự điều khiển, biến lạ "Mẫu SMS có biến không có thật: X", ngoặc lẻ "Mẫu SMS có dấu ngoặc { } lẻ", thiếu `{MA_VOUCHER}`. | edge-config-settings#1 | chưa có | E2E |
| 29.5 | Mẫu 400 ký tự: báo 3 tin. | edge-config-settings#1 | chưa có | E2E |
| 29.6 | QL, NV mở `/settings`: 404. API: 403 "Chỉ Quản trị sửa được cài đặt." | edge-config-settings#4 | chưa có | E2E |
| 29.7 | Lưu bị lỗi máy chủ hoặc mất mạng. | **chưa có** | chưa có | E2E |

### F30. Link Zalo, link app PVI

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 30.1 | Sửa link: QR vẽ lại ngay. | config#4 | F08/b2 | Video |
| 30.2 | Link không phải http(s); link có dấu cách: "Link không được có dấu cách". | edge-config-settings#2 | chưa có | E2E |
| 30.3 | Link trống: QR hiện "Chưa có link"; lưu trống được. | edge-config-settings#2 | chưa có | E2E |
| 30.4 | Link 3000 ký tự: QR hiện "Link quá dài". | edge-config-settings#2 | chưa có | E2E |
| 30.5 | 501 ký tự bị chặn, 500 ký tự được. | edge-config-settings#3 | chưa có | E2E |
| 30.6 | Link viết hoa "HTTPS://". | edge-config-settings#2 | chưa có | E2E |

### F31. Vận hành hệ thống

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 31.1 | QT xem số đo và bảng kiểm ảnh 7 ngày. | ops#1 | F08/b4 | Video |
| 31.2 | Chưa có số đo: "Chưa có số đo.", "Chưa đo". | **chưa có** | chưa có | E2E |
| 31.3 | Không có lượt kiểm trong 7 ngày: "Chưa có lượt kiểm nào trong 7 ngày." | **chưa có** | chưa có | E2E |
| 31.4 | Trang tự tải lại sau 60 giây. | **chưa có** | chưa có | E2E |
| 31.5 | QL, NV mở `/ops`: 404. | ops#2 | chưa có | E2E |

### F32. Sidebar, menu theo quyền

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 32.1 | Menu theo vai: QT đủ mục; QL không có Cài đặt, Vận hành; NV theo quyền. | edge-config-shell#4 | F02/b3 (NV thấy mục Trường) | Video |
| 32.2 | NV không có quyền nào: sidebar trống. | edge-config-shell#7 | chưa có | E2E |
| 32.3 | Gõ URL trang không có quyền: 404. | edge-config-shell#4 | chưa có | E2E |
| 32.4 | Mục đang mở được đánh dấu; mục "Ngân hàng" không sáng khi đang ở "Mã giới thiệu". | edge-config-shell#6 | chưa có | E2E |
| 32.5 | Thu gọn, mở nhóm menu. | **chưa có** | chưa có | E2E |

### F33. Menu tài khoản, giao diện sáng tối

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 33.1 | Mở menu tài khoản, chọn "Thông tin cá nhân". | edge-config-shell#1 | chưa có | Video (thiếu) |
| 33.2 | Esc đóng menu, focus về nút tài khoản. | auth#4 | chưa có | E2E |
| 33.3 | Bấm ra ngoài đóng menu. | **chưa có** | chưa có | E2E |
| 33.4 | Tên dài trong nút tài khoản; chữ cái đầu khi tên có HTML, emoji. | edge-config-shell#1, #2 | chưa có | E2E |
| 33.5 | Bấm "Đổi giao diện sáng, tối"; tải lại vẫn giữ. | **chưa có** | chưa có | Video (thiếu) |
| 33.6 | Trình duyệt chặn `localStorage`: đổi giao diện không được báo lỗi. `toggleTheme` gọi `setItem` không bọc try. | **chưa có** | chưa có | E2E |

### F34. Điện thoại: thanh đáy, sidebar trượt

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 34.1 | Thanh đáy có 3 trang và nút Thêm. | mobile#1 | F11/b1 | Video |
| 34.2 | Nút Thêm mở sidebar trượt; chọn mục thì sidebar đóng, chuyển trang. | mobile#1 | F11/b2 | Video |
| 34.3 | Thanh đáy đánh dấu mục đang mở. | mobile#1 | F11/b3 | Video |
| 34.4 | Esc hoặc bấm nền tối đóng sidebar. | mobile#2 | chưa có | E2E |
| 34.5 | Bấm nút "Đóng menu điều hướng". | **chưa có** | chưa có | E2E |
| 34.6 | NV không có trang nghiệp vụ: thanh đáy chỉ có nút Thêm. | mobile#3 | chưa có | E2E |
| 34.7 | Tab khi sidebar đóng; Tab bị giữ trong sidebar khi mở, phần nền `inert`. | mobile#4, #5 | chưa có | E2E |
| 34.8 | Menu tài khoản trong sidebar trượt, Esc. | mobile#6 | chưa có | E2E |
| 34.9 | Nút quay lại đóng sidebar; back, forward không mở lại; đổi query cũng đóng. | mobile#7, #8, #9 | chưa có | E2E |
| 34.10 | Kéo khổ lên trên 900 px. | mobile#10 | chưa có | E2E |
| 34.11 | Giữ vị trí cuộn. | mobile#11 | chưa có | E2E |
| 34.12 | Không trang nào cuộn ngang; bảng cuộn ngang trong khung. | mobile#12 | F11/b4 | Video |
| 34.13 | Ô tìm full width; bảng Bộ lọc nằm trọn màn hình, trên thanh đáy; focus trong bảng lọc. | mobile#13, #17, #18, #19 | F11/b5 | Video |
| 34.14 | Lề 16 px; bảng trống. | mobile#14 | chưa có | E2E |
| 34.15 | Hộp thoại vừa màn hình; nền không cuộn sau hộp thoại. | mobile#15, #21 | chưa có | E2E |
| 34.16 | Khổ 320 và 390 px: thanh đáy đủ chỗ. | mobile#16 | chưa có | E2E |
| 34.17 | Máy tính không có thanh đáy. | mobile#22 | chưa có | E2E |
| 34.18 | Đăng xuất và đổi giao diện từ sidebar trượt. | **chưa có** | chưa có | Video (thiếu) |

### F35. Tải ảnh lên, xem ảnh

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 35.1 | Tải ảnh đúng: trả key, ảnh hiện trong hộp. | config#1 | F03/b4, F03/b5 | Video |
| 35.2 | Thư mục ngoài samples, qr, logos: 400 "Thư mục ảnh không hợp lệ." | edge-config-api#3 | chưa có | E2E |
| 35.3 | Không có file "Chưa chọn ảnh."; file 0 byte; file không phải ảnh. | edge-config-api#3 | chưa có | E2E |
| 35.4 | `Content-Length` trên 22 MB: 400 "Ảnh lớn hơn 20 MB." trước khi đọc body. | **chưa có** | chưa có | E2E |
| 35.5 | File trên 20 MB: 400 hoặc 413. | edge-config-banks#11, edge-config-codes#20 | chưa có | E2E |
| 35.6 | NV không quản ngân hàng nào gọi tải ảnh: 403. | **chưa có** | chưa có | E2E |
| 35.7 | Kho S3 lỗi: "Không tải được ảnh lên kho lưu trữ. Thử lại sau ít phút." | **chưa có** | chưa có | E2E |
| 35.8 | Xem ảnh với key lạ: 404. | edge-config-api#3 | chưa có | E2E |
| 35.9 | Xem ảnh không có phiên: 401. | **chưa có** | chưa có | E2E |

### F36. Luật chung của API quản lý

| Mã | Ca | E2E | Video | Đề xuất |
|---|---|---|---|---|
| 36.1 | Mọi API ghi: Origin lạ 403, không phiên 401. | edge-config-api#1 | chưa có | E2E |
| 36.2 | Body không phải JSON hoặc sai kiểu: 400. | edge-config-api#2 | chưa có | E2E |
| 36.3 | NUL, ký tự điều khiển, surrogate lẻ: 400 kèm `field`. | edge-config-api#4 | chưa có | E2E |
| 36.4 | Có phiên nhưng thiếu quyền: 403. | edge-config-users#8, edge-config-settings#4 | chưa có | E2E |
| 36.5 | `/api/admin/schools/options` khi không quản ngân hàng nào: 403. | edge-config-users#8 | chưa có | E2E |
| 36.6 | Lỗi không kèm câu chữ: "Không lưu được. Thử lại sau ít phút." | edge-business-dialogs#1 | chưa có | E2E |

## 3. Bảng tra mã test

### 3.1. Spec

| Mã | Nội dung chính |
|---|---|
| auth#1 | Sai mật khẩu lần 3, 4 hiện hộp nhắc; lần 5 khoá. |
| auth#2 | QT mở khoá tài khoản Khoá tạm. |
| auth#3 | Focus của hộp nhắc. |
| auth#4 | Esc đóng menu tài khoản. |
| auth#5 | NV mở `/users` bị 404. |
| auth#6 | Tạo tài khoản, đặt lại mật khẩu, đăng nhập. |
| auth#7 | Clipboard bị chặn. |
| config#1 | Tạo trường, ngân hàng 2 khung ảnh, mã giới thiệu. |
| config#2 | NV chỉ thấy ngân hàng của mình. |
| config#3 | Enter trong ô xã. |
| config#4 | QR link Zalo. |
| ops#1 | QT xem Vận hành hệ thống. |
| ops#2 | NV mở `/ops` bị 404. |
| edge-config-login#1..6 | Ô trống, tên lạ; điện thoại viết hoa, bộ đếm, khoá; bấm đúp, mất mạng; tài khoản Đã khoá, khoá giữa phiên; `/login` khi đã đăng nhập, Origin 403; hai tab đăng xuất. |
| edge-config-profile#1..5 | Tên dài, HTML, "Chưa có"; lỗi Sửa thông tin và Đổi mật khẩu, Huỷ; sai mật khẩu hiện tại 5 lần; đổi mật khẩu và phiên; API 403, 401. |
| edge-config-users#1..10 | Tên dài; tìm không dấu, `%_`; tìm nhiều từ; 16 dòng, id sai; lỗi form, trùng; ba lượt cùng lúc; đổi vai; QL với QT, NV gọi API; trang của mình; đặt lại mật khẩu, hai tab khoá. |
| edge-config-api#1..4 | Origin, phiên; body sai; uploads, images, wards; ký tự lạ. |
| edge-config-shell#1..7 | Tên dài; chữ cái đầu; `/` và 404; menu theo vai; bớt quyền giữa phiên; đánh dấu Kho mã; sidebar trống. |
| edge-config-settings#1..4 | Lỗi mẫu SMS; link sai, trống, dài; 501 và 500; QL, NV bị chặn. |
| edge-config-schools#1..13 | Tên dài; ký tự đặc biệt; tìm; nhiều từ; phân trang, đóng; lỗi form; SĐT; Enter, xã sai, Sửa rồi Huỷ, trùng tên; quyền `schools` không có Excel; Excel không có `schools`; hai tab đóng; xuất Excel; clipboard và tên file QR. |
| edge-config-banks#1..15 | Tên dài, Tắt rồi Huỷ; lỗi form; tìm người quản; ba lượt cùng mã; người quản bị khoá; lỗi ô người quản; NV giao; hai tab bỏ khung; hai tab thêm khung; ngân hàng mới, lỗi hướng dẫn; ảnh mẫu lớn; khoá nút khi tải; huỷ chọn file; lỗi 500; logo. |
| edge-config-codes#1..23 | Tên dài; `%_`; nhiều từ; 300 ms; mạng chậm; tháng và 300 ms; lọc kết hợp; ẩn mã ngừng; URL sai; nút quay lại; qua năm; trước 1900; lỗi form; ba lượt cùng lúc; ngân hàng, trường sai; NV giao; ngân hàng tắt khi Sửa; ngân hàng vừa tắt; link có dấu cách; QR lớn; khoá nút khi tải QR; huỷ chọn file; lỗi 500. |
| mobile#1..22 | Thanh đáy, sidebar trượt, focus, back, khổ màn hình, bảng lọc, hộp thoại (xem F34). |
| edge-business-dialogs#1..2 | Lỗi 500 ở Sửa tài khoản, Sửa trường, Sửa thông tin, Đổi mật khẩu; hộp xác nhận lỗi giữa chừng. |

DB test liên quan nằm ở `tests/db`: `login.test.ts`, `users.test.ts`, `banks.test.ts`, `referralCodes.test.ts`, `schools.test.ts`, `profile.test.ts`, `settings.test.ts`, `edgeConfig.test.ts`.

### 3.2. Bước video

| Flow | Bước |
|---|---|
| F01 `01-dang-nhap-khoa.spec.ts` | b1 Nhân viên gõ sai mật khẩu 5 lần, lần 3 và 4 hiện hộp nhắc. b2 Đúng mật khẩu vẫn bị chặn trong 15 phút. b3 Quản trị đăng nhập, thấy tài khoản Khoá tạm. b4 Quản trị bấm Mở khoá. b5 Nhân viên đăng nhập lại được. |
| F02 `02-tai-khoan-nhan-vien.spec.ts` | b1 Quản trị tạo tài khoản Nhân viên có quyền Trường và QR, Xuất Excel. b2 Quản trị mở tài khoản, đặt lại mật khẩu. b3 Nhân viên đăng nhập bằng mật khẩu vừa đặt lại, thấy mục Trường. b4 Nhân viên đổi mật khẩu ở trang Cá nhân. b5 Mật khẩu cũ không dùng được, mật khẩu mới đăng nhập được. |
| F03 `03-cau-hinh.spec.ts` | b1 Tạo trường: chọn tỉnh, tìm xã. b2 Chép link trường, tải ảnh QR của trường. b3 Tạo ngân hàng, giao người quản. b4 Cài hướng dẫn và 2 khung ảnh có ảnh mẫu. b5 Tạo mã giới thiệu có ảnh QR, gắn trường. b6 Kho mã: lọc theo ngân hàng ngay khi chọn, không có nút Lọc. b7 Kho mã theo tháng: lùi một tháng rồi về tháng này. |
| F08 `08-van-hanh-cai-dat.spec.ts` | b1 Sửa mẫu SMS: bấm thêm biến, xem trước số ký tự. b2 Sửa link Zalo và link app PVI: QR vẽ lại ngay. b3 Lưu cấu hình, tải lại trang vẫn giữ giá trị mới. b4 Xem Trang 18 Vận hành hệ thống. |
| F11 `11-quan-ly-dien-thoai.spec.ts` | b1 Quản trị đăng nhập trên điện thoại: thanh đáy có 3 trang và nút Thêm. b2 Nút Thêm mở sidebar trượt, chọn Cài đặt thì sidebar đóng và chuyển trang. b3 Thanh đáy chuyển sang Hồ sơ học sinh, mục đang mở được đánh dấu. b4 Bảng cuộn ngang trong khung, trang không cuộn ngang. b5 Bảng Bộ lọc nằm trọn màn hình, trên thanh đáy. b6 Trang Trường: nút Chép link chép link web học sinh. |

## 4. Đề xuất

### 4.1. Video theo người xem

Học sinh trên điện thoại: nhóm này không có ca nào cho học sinh. Link trường và QR trường dẫn sang web học sinh, phần đó thuộc nhóm web học sinh.

**V-A. Đăng nhập và bị khoá** (người xem: mọi nhân viên, Manager, Quản trị). Giữ F01, thêm bước 1 và bước 7.
1. Mở trang đăng nhập, bấm hiện mật khẩu, đăng nhập đúng (1.1, 1.11).
2. Gõ sai mật khẩu, lần 3 và 4 thấy hộp "Sắp bị khoá" (1.6, 2.1).
3. Sai lần 5 thì bị khoá 15 phút (2.2).
4. Nhập đúng mật khẩu vẫn bị chặn (2.3).
5. Quản trị thấy tag "Khoá tạm", bấm Mở khoá (2.7, 11.3).
6. Nhân viên đăng nhập lại được (2.8).
7. Đăng xuất ở menu tài khoản, thành bước riêng (3.1).

**V-B. Trang Cá nhân** (người xem: mọi nhân viên, Manager, Quản trị). Video mới, lấy F02/b4, b5 làm gốc.
1. Mở menu tài khoản, chọn "Thông tin cá nhân" (33.1, 5.1).
2. Sửa thông tin: họ tên, SĐT (6.1).
3. Đổi mật khẩu: nhập sai mật khẩu hiện tại, thấy lỗi ở ô (7.5).
4. Nhập hai lần mật khẩu mới khác nhau, thấy lỗi (7.4).
5. Đổi đúng, thấy "Đã đổi" (7.1).
6. Đổi giao diện tối, tải lại vẫn giữ (33.5).
7. Đăng xuất, đăng nhập bằng mật khẩu mới (7.2).

**V-C. Quản lý tài khoản** (người xem: Quản trị, Manager). Mở rộng F02.
1. Xem bảng tài khoản, các tag trạng thái (8.1, 8.8).
2. Tìm tài khoản theo tên (8.2).
3. Thêm Nhân viên có quyền, bấm Chép mật khẩu (9.1, 9.2).
4. Thêm Manager: nhóm Quyền ẩn (9.4).
5. Sửa quyền của Nhân viên (10.1).
6. Mở chi tiết tài khoản, đặt lại mật khẩu (13.1, 12.1, 12.2).
7. Khoá tài khoản rồi mở khoá tài khoản "Đã khoá" (11.1, 11.2).
8. Mở khoá tài khoản "Khoá tạm" đã có ở V-A, không lặp lại.

**V-D. Trường** (người xem: Quản trị, Manager, Nhân viên có quyền Trường). Mở rộng F03/b1, b2.
1. Xem bảng trường, tìm trường (14.1, 14.2).
2. Thêm trường: chọn tỉnh, tìm xã (15.1, 15.2).
3. Chép link, tải ảnh QR (17.1, 17.3).
4. Sửa trường rồi lưu (15.11).
5. Đóng trường (16.1).
6. Mở lại trường (16.2).

**V-E. Ngân hàng** (người xem: Quản trị, Manager, Nhân viên có quyền Quản lý ngân hàng). Mở rộng F03/b3, b4.
1. Xem bảng ngân hàng, giải thích từng cột (19.1).
2. Thêm ngân hàng có logo, giao người quản tìm theo mã tài khoản (20.1, 21.1, 21.3, 22.1). Logo hiện thiếu ở F03/b3 (commit 4493a2d).
3. Mở Sửa: thấy logo hiện tại, đổi logo, gỡ một người quản (20.5, 22.2, 22.3, 21.5).
4. Hướng dẫn: nhập bước, 2 khung ảnh có ảnh mẫu, bỏ tick "Kiểm trên ảnh", bỏ một khung (24.1, 24.3, 24.4).
5. Tắt ngân hàng rồi Bật lại (23.1, 23.3).

**V-F. Kho mã giới thiệu** (người xem: Quản trị, Manager, Nhân viên có quyền Quản lý ngân hàng). Mở rộng F03/b5 tới b7.
1. Xem bảng mã, giải thích cột và 3 tag trạng thái (25.1, 25.13).
2. Thêm mã có ảnh QR, gắn trường (27.1).
3. Lọc theo ngân hàng, tìm theo tên, ẩn mã đã ngừng (25.2, 25.3, 25.7).
4. Sửa mã: đổi chỉ tiêu, gỡ một trường (27.15, 27.18).
5. Lùi một tháng thấy chỉ tiêu tháng cũ không đổi, rồi về tháng này (26.1, 26.5).
6. Ngừng mã rồi Dùng lại (28.1, 28.2).

**V-G. Nhân viên hậu kiểm được giao ngân hàng** (người xem: nhân viên hậu kiểm). Video mới, chưa có flow nào.
1. Đăng nhập, menu có Ngân hàng và Mã giới thiệu, không có Tài khoản (32.1).
2. Bảng ngân hàng chỉ có ngân hàng của mình, không có nút Thêm ngân hàng (19.5).
3. Sửa ngân hàng của mình, đổi logo, không có ô người quản (20.6, 22.13).
4. Sửa hướng dẫn ngân hàng của mình (24.16).
5. Kho mã chỉ có mã ngân hàng mình; thêm một mã (25.14, 27.21).

**V-H. Cài đặt và Vận hành** (người xem: Quản trị). Giữ F08, thêm một ca lỗi.
1. Sửa mẫu SMS, bấm thêm biến, xem số ký tự (29.1).
2. Gõ mẫu có dấu, thấy lỗi "Mẫu SMS viết không dấu", sửa lại (29.3).
3. Sửa link Zalo, link app PVI, QR vẽ lại (30.1).
4. Lưu, tải lại vẫn giữ (29.2).
5. Xem Vận hành hệ thống (31.1).

**V-I. Trang quản lý trên điện thoại** (người xem: Quản trị, Manager, mọi nhân viên). Giữ F11, thêm bước 7.
1. Thanh đáy 3 trang và nút Thêm (34.1).
2. Nút Thêm mở sidebar trượt, chọn mục thì đóng (34.2).
3. Thanh đáy đánh dấu mục đang mở (34.3).
4. Bảng cuộn ngang trong khung (34.12).
5. Bảng Bộ lọc nằm trọn màn hình (34.13).
6. Chép link trường (17.1, 17.4).
7. Đổi giao diện và đăng xuất từ sidebar trượt (34.18, 3.3).

### 4.2. Ca chỉ cần e2e

Mọi ca có cột Đề xuất là **E2E** ở mục 2 chỉ cần e2e, không cần video. Số lượng ở mục 6.

### 4.3. Khoảng trống phải bổ sung

Ca lớn chưa có e2e, phải viết e2e trước khi quay video:
- 1.11 hiện, ẩn mật khẩu.
- 9.2 Chép mật khẩu thành công.
- 11.2 mở khoá tài khoản "Đã khoá".
- 15.11 Sửa trường rồi lưu.
- 16.2 Mở lại trường.
- 21.3 tìm người quản theo mã tài khoản; 21.5 gỡ người quản.
- 22.3 đổi logo; 22.13 NV giao đổi logo.
- 23.1 Tắt ngân hàng có xác nhận; 23.3 Bật lại.
- 24.3 tick "Kiểm trên ảnh"; 24.16 NV giao sửa hướng dẫn.
- 26.5 chỉ tiêu tháng cũ giữ nguyên khi sửa.
- 27.15 Sửa mã rồi lưu; 27.18 gỡ trường khỏi mã.
- 28.2 Dùng lại mã.
- 33.5 đổi giao diện sáng tối.
- 3.3, 34.18 đăng xuất, đổi giao diện từ sidebar trượt.

Ca nhỏ chưa có e2e:
- Logo: 22.5 tới 22.12, 22.14.
- Đăng nhập, phiên: 1.10, 1.15, 2.9 tới 2.13, 4.6, 12.5.
- Tài khoản: 8.3, 9.9, 9.12, 10.5, 11.7.
- Trạng thái trống: 14.5, 19.3, 19.4, 25.12, 31.2, 31.3.
- Khác: 15.4, 15.8, 21.4, 21.8, 23.6, 24.13, 24.14, 27.4, 27.5, 27.13, 27.14, 27.22, 29.7, 31.4, 32.5, 33.3, 33.6, 34.5, 35.4, 35.6, 35.7, 35.9.

Ca chỉ kiểm một phần: 2.6, 6.4, 9.4, 10.1, 13.1, 20.5, 21.9, 25.13 (thiếu "Hết chỗ"), 27.21.

Ghi chú khác:
- F03/b3 tạo ngân hàng không có logo. Logo đã có từ commit 4493a2d, video chưa cập nhật.
- Chưa có flow nào cho nhân viên hậu kiểm được giao ngân hàng (V-G).
- Giao diện không có nút bỏ logo và nút bỏ ảnh QR đã chọn. Chỉ API bỏ được logo (22.12, 27.22).
- `toggleTheme` gọi `localStorage.setItem` không bọc try. Mình chưa kiểm khi trình duyệt chặn bộ nhớ (33.6).

## 5. Chữ "ZZE2E" và tên giả hiện trong video

Nguồn chung:
- `scripts/e2e-seed.ts`: `E2E_NAME = "ZZE2E "`, `E2E_PREFIX = "zz_e2e_"`, người dùng "E2E Quản trị", "E2E Nhân viên", "E2E Khoá", "E2E Không quyền", "E2E Hậu kiểm", "E2E Kiểm hai ngân hàng"; trường "ZZE2E THPT Học sinh" (qua `scripts/e2e-data.ts`); ngân hàng "ZZE2E HS MB", "ZZE2E HS VPBank", "ZZE2E HS TPBank" mã ZZE2EH1 tới ZZE2EH3; mã HS-MB-01 và các mã HS khác.
- `scripts/e2e-seed-business.ts` và `scripts/e2e-data-business.ts`: người dùng "E2E Biên Một", "E2E Biên Hai", "E2E Biên Ba", "E2E Biên Bốn" (B_USER1 tới 4); trường "ZZE2E THPT Biên Nghiệp Vụ Có Tên Trường Rất Dài…" và "ZZE2E THPT Biên Hai", người liên hệ "E2E", "E2E Biên"; ngân hàng "ZZE2E Biên Ngân hàng …" mã ZZE2EB1 tới ZZE2EB3; mã BIEN-B1-01 và các mã Biên khác; khách "Biên …".
- Dữ liệu thật của chủ dự án trong DB local: trường "ZZDEMO THPT Nguyễn Du", ngân hàng ZZVPB, 9 mã `ND-*`, tài khoản `admin`.

| Video, bước | Chữ hiện trên màn hình | Nguồn |
|---|---|---|
| Mọi flow | Nút tài khoản ở sidebar: "E2E Quản trị", "E2E Nhân viên", "E2E Khoá" và chữ cái đầu. | `scripts/e2e-seed.ts` |
| Mọi flow | Ô tên đăng nhập: `zz_e2e_admin`, `zz_e2e_staff`, `zz_e2e_lock`. | `scripts/e2e-seed.ts`, `e2e/flows/support.ts` |
| Mọi flow QT | `loginAs` vào `/users`: bảng liệt kê mọi tài khoản seed, tên "E2E …", tên đăng nhập `zz_e2e_*`. | `scripts/e2e-seed.ts`, `scripts/e2e-seed-business.ts`, `scripts/e2e-data-business.ts` |
| Mọi flow | Lớp phủ góc trên trái: tiêu đề test "Flow N: …" và tên bước. Lớp phủ góc dưới phải: locator tiếng Anh, có chứa tên đã gõ. | `playwright.config.ts` (`show.test`, `show.actions`), `e2e/flows/video.ts` |
| F01/b1, b2 | Gõ `zz_e2e_lock` 6 lần. | `scripts/e2e-seed.ts` |
| F01/b3 | Ô tìm "zz_e2e_lock"; dòng "E2E Khoá". | `scripts/e2e-seed.ts`, `e2e/flows/01-dang-nhap-khoa.spec.ts` |
| F01/b4 | Hộp xác nhận "Mở khoá tài khoản E2E Khoá?". | `scripts/e2e-seed.ts` |
| F01/b5 | Trang Cá nhân: "E2E Khoá", `zz_e2e_lock`. | `scripts/e2e-seed.ts` |
| F02/b1 | Gõ họ tên "E2E Trần Thu Ngân", tên đăng nhập `zz_e2e_thungan`. Hộp "Mật khẩu mới của E2E Trần Thu Ngân là:". | `e2e/flows/02-tai-khoan-nhan-vien.spec.ts` |
| F02/b2 | Tiêu đề trang chi tiết "E2E Trần Thu Ngân"; hộp "Đặt lại mật khẩu cho E2E Trần Thu Ngân?". | `e2e/flows/02-tai-khoan-nhan-vien.spec.ts` |
| F02/b3 tới b5 | Nút tài khoản và trang Cá nhân: "E2E Trần Thu Ngân", `zz_e2e_thungan`. | `e2e/flows/02-tai-khoan-nhan-vien.spec.ts` |
| F03/b1 | Gõ "ZZE2E THPT Lê Quý Đôn". Bảng trường còn có "ZZE2E THPT Học sinh", "ZZE2E THPT Biên Nghiệp Vụ …", "ZZE2E THPT Biên Hai", "ZZDEMO THPT Nguyễn Du"; cột liên hệ "E2E", "E2E Biên". | `e2e/flows/03-cau-hinh.spec.ts`, `scripts/e2e-data.ts`, `scripts/e2e-data-business.ts`, DB local |
| F03/b2 | Lớp phủ note "Ảnh QR tải về: qr-ZZE2E-THPT-Le-Quy-Don.png" và "Link đã chép: http://bank.localhost:3100/t/…". | `e2e/flows/03-cau-hinh.spec.ts` |
| F03/b3 | Gõ mã "ZZE2EF3", tên "ZZE2E VPBank Flow"; tìm người quản `zz_e2e_staff`, chọn "E2E Nhân viên". Bảng ngân hàng có "ZZE2E HS MB/VPBank/TPBank", "ZZE2E Biên Ngân hàng …", ZZVPB; cột Người quản "E2E Hậu kiểm", "E2E Kiểm hai ngân hàng", "E2E Biên …". | `e2e/flows/03-cau-hinh.spec.ts`, `scripts/e2e-seed.ts`, `scripts/e2e-seed-business.ts`, DB local |
| F03/b4 | Tiêu đề hộp "Hướng dẫn mở tài khoản - ZZE2E VPBank Flow". | `e2e/flows/03-cau-hinh.spec.ts` |
| F03/b5 | Gõ tên mã "ZZE2E VPB Lê Quý Đôn"; chọn trường "ZZE2E THPT Lê Quý Đôn"; ô ngân hàng "ZZE2E VPBank Flow". | `e2e/flows/03-cau-hinh.spec.ts` |
| F03/b6, b7 | Kho mã trang 1 đầy mã seed: "ZZE2E HS …" (HS-MB-01 …), "ZZE2E Biên B1" tới "B3" (BIEN-B1-01 …), mã `ND-*`; cột trường có trường ZZE2E; người tạo "E2E Quản trị". Ô lọc ngân hàng chọn "ZZE2E VPBank Flow". | `scripts/e2e-seed.ts`, `scripts/e2e-seed-business.ts`, DB local |
| F08/b2 | Gõ link app PVI "https://pvi.example/app-e2e". | `e2e/flows/08-van-hanh-cai-dat.spec.ts` |
| F08/b4 | Bảng kiểm ảnh 7 ngày có thể có "ZZE2E HS VPBank", "ZZE2E HS TPBank" từ lượt kiểm của flow 07. | `scripts/e2e-seed.ts`, `e2e/flows/07-kiem-anh.spec.ts` |
| F11/b1 | Bảng `/users` trên điện thoại: tên "E2E …", `zz_e2e_*`. | như dòng "Mọi flow QT" |
| F11/b3 tới b5 | `/customers` xếp mới nhất trước, nên khách seed nghiệp vụ hiện đầu: "Biên <script>alert(1)</script>", "Biên 😀 Emoji Ðức", "=1+2 Biên Công Thức", "-Biên Trừ", "Biên \"Kép\" 'Đơn' 50% a_b \\ x", tên 100 ký tự, "Biên Chờ Kiểm A" tới "Q" sau khi lọc, "Phạm Thị Khổ Hẹp"; trường "ZZE2E THPT Biên Nghiệp Vụ …"; ngân hàng "ZZE2E Biên Ngân hàng …". | `scripts/e2e-data-business.ts`, `scripts/e2e-seed-business.ts` |
| F11/b6 | Bảng Trường: "ZZE2E THPT Học sinh" và các trường ZZE2E khác; link chép là `http://bank.localhost:3100/t/…`. | `scripts/e2e-data.ts`, `scripts/e2e-data-business.ts` |

Ngoài chữ giả, video còn lộ ba thứ người dùng thật không nên thấy:
- Tiêu đề "Flow N:" và locator tiếng Anh ở lớp phủ.
- Link `localhost`.
- Chuỗi "app-e2e" trong link PVI.

## 6. Số đếm

- Tính năng: 36.
- Ca: 312.
- Ca chưa có e2e (cột E2E ghi **chưa có**): 71. Trong đó 20 ca lớn cần video, 51 ca nhỏ.
- Ca chỉ kiểm một phần: 9.
- Ca đề xuất video: 88. Trong đó 43 ca đã có trong video (1 ca ở F09 của nhóm khác), 45 ca phải thêm.
- Ca chỉ cần e2e: 224.
