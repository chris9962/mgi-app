# Rà tính năng, ca và độ phủ e2e: nhóm nghiệp vụ trang quản lý

Ngày rà: 2026-11-10. Phạm vi: tên miền `admin.localhost:3100`, các trang Hồ sơ học sinh (danh sách, chi tiết), hậu kiểm, xem ảnh,
kiểm ảnh tự động, trang Ngân hàng nhóm Nghiệp vụ, Mã voucher, Tin SMS lỗi, Vận hành hệ thống, Xuất Excel, trang tổng quan `/`.
Agent chỉ đọc repo, không chạy test. Nhánh lấy từ code: `fail(...)` và `{ ok: false }` ở `src/server/*.ts`, zod ở `src/lib/*Form.ts`,
điều kiện render ở `src/app/admin/(shell)/**` và `src/components/**`, mã 400/403/404/409/413 ở `src/app/api/admin/**`.

## Tóm tắt số

| Mục | Số |
|---|---|
| Tính năng | 15 |
| Ca | 213 |
| Ca chưa có e2e | 74 |
| Trong đó ca chỉ có test DB (`tests/db/**`) | 36 |
| Ca đề xuất có video | 65 |
| Ca đề xuất video mà video hiện có chưa phủ, hay chỉ phủ ở vai khác | 38 |
| Ca chỉ cần e2e | 148 |

Cách đếm:
- Mỗi dòng ở mục 2 là một ca. Cột E2E ghi "**chưa có**" thì đếm là chưa có e2e, kể cả khi có test DB.
- Flow ở `e2e/flows/*` cũng là test Playwright (project `flows`), nên ca chỉ phủ ở flow vẫn đếm là có e2e.
- `e2e/flows/07-kiem-anh.spec.ts` và `e2e/photoCheck.spec.ts` tự bỏ qua khi `.env.local` thiếu `OCR_PYTHON`. Máy thiếu OCR thì 5 ca (HS-13, HS-22, KA-01, KA-04, KA-05) mất độ phủ.

## Ký hiệu cột E2E và Video

| Ký hiệu | File | Tên test (đầu câu) |
|---|---|---|
| eb-01 | `e2e/edge-business.spec.ts` | "Trang 3: tên 100 ký tự có dấu cách và tên liền không dấu cách, ở 1366 và 390 px không tràn ngang..." |
| eb-02 | như trên | "Trang 3: tên có thẻ HTML, ngoặc, %, _, \\, emoji hiện nguyên văn; tìm ký tự đặc biệt, NUL, chuỗi giống SQL không lỗi 500" |
| eb-03 | như trên | "Trang 3 tìm: có dấu, không dấu, hoa thường, một phần, nhiều từ khác thứ tự, SĐT có dấu cách, ô chỉ có khoảng trắng, không khớp" |
| eb-04 | như trên | "Trang 3: dán 20.000 ký tự vào ô tìm không ra lỗi 431, URL tìm 2.000 ký tự hiện câu báo rỗng" |
| eb-05 | như trên | "Trang 3 phân trang: 16 hồ sơ ra 15 và 1 dòng, đổi từ khoá về trang 1, đổi lọc về trang 1..." |
| eb-06 | như trên | "Trang 3 URL lạ: số trang sai, giá trị lọc không có, ngày sai hoặc năm 0001 không lỗi 500; bỏ chip chỉ bỏ đúng một lọc" |
| eb-07 | như trên | "Trang 3: bấm Quay lại của trình duyệt khôi phục bộ lọc của bước trước, chip và ô chọn khớp URL" |
| eb-08 | như trên | "Trang 3 ngày giờ Việt Nam: 23:30 ngày 31/10 và 00:30 ngày 01/11 hiện đúng ngày, lọc trọn ngày..." |
| eb-09 | như trên | "Trang 3 phân quyền: Nhân viên chỉ thấy hồ sơ có ngân hàng mình quản ở trang và API, không có quyền Xuất Excel thì không có nút và route trả 403" |
| eb-10 | như trên | "Trang 3 xuất Excel: đúng bộ lọc, không có dòng nào vẫn tải được, chuỗi bắt đầu bằng = + - @ là chữ..." |
| eb-11 | như trên | "Trang 3 xuất Excel lọc trọn ngày giờ Việt Nam: ngày 31/10 chỉ ra hồ sơ 23:30..." |
| eb-12 | như trên | "Trang 3: lọc Chờ kiểm tra còn 1 dòng ở trang 2, mở hồ sơ đó bấm Đạt rồi bấm Quay lại của trình duyệt..." |
| ebd-01 | `e2e/edge-business-detail.spec.ts` | "Trang 4: tên 100 ký tự, tên liền, ghi chú 1.000 ký tự liền ở 1366 và 390 px không tràn ngang..." |
| ebd-02 | như trên | "Trang 4: tên có <script>, phụ huynh có <img onerror>, ghi chú có thẻ HTML, xuống dòng, emoji hiện nguyên văn dạng chữ" |
| ebd-03 | như trên | "Trang 4 URL sai: id không phải uuid, uuid không có trả 404 ở trang, API hồ sơ và route ảnh" |
| ebd-04 | như trên | "Trang 4 Sửa thông tin: ô trống, chỉ khoảng trắng, quá dài, SĐT sai dạng, SĐT trùng báo ở đúng ô; Huỷ rồi mở lại...; Enter gửi form; bấm Lưu hai lần..." |
| ebd-05 | như trên | "Trang 4 ghi chú: ô nhập chặn ở 1.000 ký tự, API từ chối 1.001 ký tự, ký tự điều khiển và nửa cặp surrogate..." |
| ebd-06 | như trên | "Trang 4: hộp Tải ảnh thay thế, Ghi chú, Sửa thông tin, Đạt, Không đạt đang gửi thì Huỷ bị khoá..." |
| ebd-07 | như trên | "Trang 4 hộp Đạt đang gửi: nhấn Esc 4 lần hay trình duyệt tự đóng thẻ dialog thì hộp vẫn mở..." |
| ebd-08 | như trên | "Trang 4 tải ảnh thay thế: không chọn file, file 0 byte, file chữ đổi đuôi .jpg, file 21 MB, 23 MB..." |
| ebd-09 | như trên | "Trang 4 tải ảnh thay thế: khung ảnh bị gỡ lúc hộp đang mở thì báo không tìm thấy khung ảnh dưới ô Khung ảnh" |
| ebd-10 | như trên | "Trang 4 hai tab: tab A đánh dấu Đạt, tab B bấm Đạt hay Không đạt đều báo đã có người đánh dấu; tab B đang sửa thông tin thì báo hồ sơ đã có voucher" |
| ebd-11 | như trên | "Trang 4 hai tab: tab A tải ảnh thay thế, tab B đang mở trang cũ bấm Đạt thì báo ảnh vừa được thay..." |
| ebd-12 | như trên | "Trang 4 mạng chậm: tự tải ảnh thay thế rồi bấm Đạt ngay thì Đạt được..." |
| ebd-13 | như trên | "Trang 4: quản trị gỡ khung ảnh lúc trang đang mở, ảnh của khung đó vẫn đang dùng, người kiểm bấm Đạt thì Đạt được..." |
| ebd-14 | như trên | "Trang 4 hai tab cùng tải ảnh thay thế một khung: người tải sau ghi đè..." |
| ebd-15 | như trên | "Trang 4 mạng chậm: bấm Không đạt rồi bấm Đạt ngay thì Đạt được..." |
| ebd-16 | như trên | "Trang 4 hai tab: cùng bấm nút Đạt trong hộp xác nhận đúng một lúc..." |
| ebd-17 | như trên | "Trang 4 hai tab: tab A bấm Không đạt, tab B đang mở trang cũ bấm Đạt..." |
| ebd-18 | như trên | "Trang 4: bấm đúp nút Đạt trong hộp xác nhận chỉ gửi một request" |
| ebd-19 | như trên | "Trang 4 phân quyền: Nhân viên mở hồ sơ ngoài phạm vi và gọi mọi API của dòng ngoài phạm vi nhận 404..." |
| ebd-20 | như trên | "Nhân viên bị bỏ giao ngân hàng lúc đang mở hộp: Lưu ghi chú, Tải lên, Lưu thông tin, Gửi lại..." (không phủ nút Đạt) |
| ebd-21 | như trên | "Trang 4 rỗng và giờ: hồ sơ chưa chọn ngân hàng chỉ có thẻ Thông tin và SMS; chưa có ảnh, chưa có ghi chú; voucher cấp 23:45..." |
| nh-1 tới nh-7 | `e2e/edge-business-lists.spec.ts`, describe "trang Ngân hàng nhóm Nghiệp vụ" | 7 test theo thứ tự trong file: chữ dài; URL lạ; tìm và 17 dòng; Chờ kiểm tra trang 2; phạm vi và rỗng; xuất Excel; xuất lọc ngày |
| vc-1 tới vc-5 | như trên, describe "Trang 12 Mã voucher" | 5 test theo thứ tự: URL lạ, tìm, 16 mã; ngày cấp; xuất lọc ngày cấp; phân quyền; xuất Excel |
| sm-1 tới sm-6 | như trên, describe "Tin SMS lỗi" | 6 test theo thứ tự: URL lạ, tìm, 16 tin; lỗi 500 ký tự; Gửi lại kiểm ô; đang Gửi lại; hai tab và mất mạng; phạm vi và rỗng |
| rv-1 | `e2e/review.spec.ts` | "Người quản ngân hàng đánh dấu Đạt, voucher hiện ở Trang 4, Trang 12 và màn kết quả của học sinh; ảnh ngân hàng khác không hiện" |
| rv-2 | như trên | "Bộ lọc hồ sơ ghi lên URL, chip bỏ được lọc, Esc đóng bảng và trả focus về nút" |
| pc-1 | `e2e/photoCheck.spec.ts` | "Học sinh nộp ảnh có họ tên và mã, worker kiểm một vòng: Trang 4 hiện Đạt và Không đạt từng khung, Trang 3 hiện x/y và lọc được" |
| op-1, op-2 | `e2e/ops.spec.ts` | "Quản trị mở Vận hành hệ thống từ menu Hệ thống..."; "Nhân viên không thấy mục Vận hành hệ thống và mở thẳng thì nhận 404" |
| cb-1, cb-2, cb-3 | `e2e/customerBanks.spec.ts` | "Trang Ngân hàng: học sinh chọn 2 ngân hàng ra 2 dòng..."; "Bộ lọc: Esc trong ô tìm trường..."; "Bộ lọc: chọn 2 ngân hàng thì nút Bộ lọc đếm 1 mục..." |
| cs-1, cs-2 | `e2e/edge-config-shell.spec.ts` | "khung trang: / đưa Quản trị và Quản lý về Tài khoản, Nhân viên về Cá nhân..."; "phân quyền: menu theo từng vai và quyền, mở thẳng URL ngoài menu trả 404" |
| cf-1 | `e2e/edge-config-settings.spec.ts` | "Cài đặt: Quản lý và Nhân viên mở Cài đặt, Vận hành nhận 404..." |
| mb-1, mb-2, mb-3 | `e2e/mobile.spec.ts` | "điện thoại: không trang quản lý nào cuộn ngang cả trang"; "điện thoại 360 và 390 px: báo lỗi xuất Excel nằm trọn trong màn hình"; "điện thoại: Quay lại chỉ đổi chuỗi lọc trên URL cũng đóng ngăn..." |
| V5 "bước" | `e2e/flows/05-hau-kiem.spec.ts` | video hậu kiểm, đăng nhập `zz_e2e_kiem` |
| V6 "bước" | `e2e/flows/06-sms.spec.ts` | video SMS, vai Quản trị |
| V7 "bước" | `e2e/flows/07-kiem-anh.spec.ts` | video kiểm ảnh, vai Quản trị, bỏ qua khi thiếu OCR |
| V8 "bước" | `e2e/flows/08-van-hanh-cai-dat.spec.ts` | chỉ bước "Xem Trang 18 Vận hành hệ thống" thuộc phạm vi |
| V9 "bước" | `e2e/flows/09-xuat-excel.spec.ts` | video xuất Excel, vai Quản trị; bước "Trang 5 Trường" thuộc nhóm Cấu hình |
| V10 "bước" | `e2e/flows/10-trang-ngan-hang.spec.ts` | video trang Ngân hàng |
| V11 "bước" | `e2e/flows/11-quan-ly-dien-thoai.spec.ts` | video quản lý trên điện thoại, chỉ bước Bộ lọc của Hồ sơ học sinh thuộc phạm vi |

Cột Đề xuất: "Video XX-n" là video ở mục 4. "E2E" là ca chỉ cần e2e. **thiếu e2e** và **thiếu video** đánh dấu chỗ chưa có.

## 1. Danh sách tính năng

Quyền lấy từ `src/lib/permissions.ts`:
- Quản trị (admin) có mọi quyền. Chỉ Quản trị có quyền `system`.
- Quản lý (manager) có mọi quyền trừ `system`.
- Nhân viên (staff) có `customers` khi được giao ít nhất một ngân hàng. Các quyền cấp riêng: `export_excel`, `vouchers`, `schools`, `manage_banks`.
- Nhân viên thấy hồ sơ theo ngân hàng được giao (`customerScope`). Quản trị và Quản lý thấy tất cả.
- `reviewsBank`: người thấy tất cả, hoặc ngân hàng nằm trong danh sách được giao. Quyền `manage_banks` không mở được ảnh hay nút hậu kiểm.

Cách chặn chung:
- Trang: `requirePage(action)`. Chưa đăng nhập thì về `/login`. Thiếu quyền thì 404. Menu ẩn mục đó (`src/components/shell/menu.ts`).
- API: `requireApi(request, action)`. Origin sai trả 403, chưa đăng nhập trả 401, thiếu quyền trả 403. Bản ghi ngoài phạm vi trả 404.

| Mã | Tính năng | Trang hay route | Vai dùng được | Vai bị chặn và cách chặn |
|---|---|---|---|---|
| F1 | Danh sách hồ sơ học sinh | `/customers` (Trang 3) | Quản trị, Quản lý: mọi hồ sơ. Nhân viên được giao ngân hàng: hồ sơ có ít nhất một ngân hàng mình quản | Nhân viên chưa được giao ngân hàng (kể cả có `manage_banks`, `vouchers`, `export_excel`): menu ẩn, trang 404 |
| F2 | Chi tiết hồ sơ học sinh | `/customers/[id]` (Trang 4); `GET /api/admin/customers/[id]` | Như F1. Thẻ ngân hàng không quản chỉ hiện tên và trạng thái | Hồ sơ ngoài phạm vi, id sai: 404 (`notFound`) |
| F3 | Sửa thông tin hồ sơ | Hộp "Sửa thông tin" ở Trang 4; `PATCH /api/admin/customers/[id]` | Như F1, hồ sơ chưa có voucher | Hồ sơ đã có voucher: nút ẩn, API 409. Ngoài phạm vi: 404 |
| F4 | Hậu kiểm Đạt, Không đạt, cấp voucher | Nút Đạt, Không đạt ở thẻ ngân hàng; `POST /api/admin/customer-banks/[id]/review` | Quản trị, Quản lý, Nhân viên quản ngân hàng đó; dòng Chờ kiểm tra hoặc Không đạt | Ngân hàng không quản: nút ẩn, API 404. Dòng Đạt, Đang tạo: nút ẩn, API 409 |
| F5 | Ghi chú nội bộ | Hộp "Ghi chú" ở thẻ ngân hàng; `PUT /api/admin/customer-banks/[id]/note` | Như F4, mọi trạng thái | Ngân hàng không quản: khối ẩn, API 404 |
| F6 | Tải ảnh thay thế | Hộp "Tải ảnh thay thế"; `POST /api/admin/customer-banks/[id]/photos` | Như F4; dòng Chờ kiểm tra hoặc Không đạt; ngân hàng có khung ảnh | Dòng Đạt, Đang tạo: nút ẩn, API 409. Không quản: 404 |
| F7 | Xem ảnh | Link ảnh mở tab mới; `GET /api/admin/photos/[id]` | Người có `reviewsBank` với ngân hàng của ảnh | Không quản ngân hàng: ảnh không hiện, route 404 "Không tìm thấy ảnh." |
| F8 | Kiểm ảnh tự động | Worker `src/server/photoCheckWorker.ts`; kết quả ở khối "Xác thực ảnh" Trang 4, x/y Trang 3, cột Xác thực ảnh trang Ngân hàng | Người xem như F4 | Ngân hàng không quản: không hiện kết quả. Không có màn chạy tay |
| F9 | Trang Ngân hàng nhóm Nghiệp vụ | `/customer-banks` | Quản trị, Quản lý: mọi dòng. Nhân viên được giao ngân hàng: dòng ngân hàng mình quản | Nhân viên chưa được giao ngân hàng: menu ẩn, 404 |
| F10 | Mã voucher | `/vouchers` (Trang 12) | Quản trị, Quản lý, Nhân viên có quyền `vouchers` (không lọc theo ngân hàng). Tên học sinh là link khi người xem thấy mọi hồ sơ | Thiếu quyền `vouchers`: menu ẩn, 404, xuất 403 |
| F11 | Worker gửi SMS | `scripts/sms-worker.ts`, `src/server/sms/*`; kết quả ở khối "SMS cho phụ huynh" Trang 4 và trang Tin SMS lỗi | Không có người dùng; máy chủ chạy | `send.ts` chưa nối nhà cung cấp, chỉ ghi log |
| F12 | Tin SMS lỗi và Gửi lại | `/sms`; badge ở menu Hệ thống; `POST /api/admin/sms/[id]/resend` | Quản trị, Quản lý: mọi tin. Nhân viên được giao ngân hàng: tin của hồ sơ trong phạm vi | Chưa được giao ngân hàng: menu ẩn, 404. Tin ngoài phạm vi: 404 |
| F13 | Xuất Excel | Nút "Xuất Excel" ở `/customers`, `/customer-banks`, `/vouchers`; `GET /api/admin/{customers,customer-banks,vouchers}/export` | Quản trị, Quản lý; Nhân viên có `export_excel` cộng quyền của trang | Thiếu quyền: nút ẩn, API 403 "Không có quyền xuất Excel." |
| F14 | Vận hành hệ thống | `/ops` (Trang 18) | Chỉ Quản trị | Quản lý, Nhân viên: menu ẩn, 404 |
| F15 | Trang tổng quan | `/` | Mọi người đã đăng nhập | Trang không có số liệu. Quản trị, Quản lý chuyển tới `/users`; Nhân viên chuyển tới `/profile` |

Ghi chú:
- Sao lưu và dọn ảnh mồ côi chỉ có script, không có màn hình. File này không tính các script đó là tính năng.
- Thiết kế không có trang tổng quan có số liệu. Code chỉ chuyển hướng ở `/`.

## 2 và 3. Ca, nhánh trong code, độ phủ e2e và video

### F1 Danh sách hồ sơ học sinh

Nguồn: `src/app/admin/(shell)/customers/page.tsx`, `src/server/customerList.ts`, `src/lib/*Filters.ts`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| HS-01 | Mở trang: bảng 15 dòng, cột Ngày, Họ tên, Lớp, Trường, SĐT phụ huynh, Ngân hàng, Người kiểm | page.tsx | rv-1, eb-05 | V5 "Nhân viên quản hai ngân hàng mở hồ sơ ở Trang 3"; V9 "Trang 3 Hồ sơ học sinh: 2 hồ sơ" | Video NV-1 |
| HS-02 | Phân trang: 16 hồ sơ ra 15 và 1; đổi từ khoá hay lọc thì về trang 1 | `PAGE_SIZE` 15 | eb-05 | chưa có | E2E |
| HS-03 | Tìm họ tên: có dấu, không dấu, một phần, nhiều từ khác thứ tự | `likeEachTerm` trên `nameSearch` | eb-03 | V5 "Nhân viên quản hai ngân hàng mở hồ sơ ở Trang 3" | Video NV-1 |
| HS-04 | Tìm SĐT phụ huynh, có dấu cách | chuỗi 3 tới 10 chữ số so `parentPhone` | eb-03 | chưa có | Video QL-1, **thiếu video** |
| HS-05 | Tìm SĐT học sinh | cùng nhánh, so `phone` | **chưa có** | chưa có | E2E, **thiếu e2e** |
| HS-06 | Từ khoá quá 8 từ, 100 ký tự bị cắt; dán 20.000 ký tự không lỗi 431; URL 2.000 ký tự ra rỗng | giới hạn từ khoá | eb-04 | chưa có | E2E |
| HS-07 | Ký tự đặc biệt, NUL, %, _, chuỗi giống SQL không lỗi 500; tên có thẻ HTML hiện nguyên văn | bỏ NUL, escape LIKE | eb-02 | chưa có | E2E |
| HS-08 | Lọc trạng thái Chờ kiểm tra | `status=pending_review` | rv-2, eb-12 | V11 "Bảng Bộ lọc nằm trọn màn hình, trên thanh đáy" (điện thoại, Quản trị) | Video NV-1, **thiếu video** ở máy tính và vai Nhân viên |
| HS-09 | Lọc trạng thái Đã kiểm tra | `status=reviewed` | eb-05 | chưa có | Video QL-1, **thiếu video** |
| HS-10 | Lọc trạng thái Mới, Đã chọn ngân hàng, Không có ngân hàng | `status` new, banks_selected, no_bank, cùng nhánh `eq` | **chưa có** (mb-3 chỉ kiểm URL `status=new`, không kiểm dòng) | chưa có | E2E, **thiếu e2e** |
| HS-11 | Lọc Số ngân hàng đạt = 1 | `passed=1` | eb-05 | chưa có | Video QL-1, **thiếu video** |
| HS-12 | Lọc Số ngân hàng đạt = 2 | `passed=2` | **chưa có** | chưa có | E2E, **thiếu e2e** |
| HS-13 | Lọc Xác thực ảnh Đủ và Thiếu theo lượt kiểm xong mới nhất | `check=full` (`total>0 && passed=total`), `check=missing` (`passed<total`) | pc-1 | V7 "Trang 3 lọc theo kết quả xác thực ảnh" | Video QL-1 (V7 là vai Quản trị, có bước worker) |
| HS-14 | Lọc Xác thực ảnh của Nhân viên chỉ xét ngân hàng mình quản | `check` lọc theo bankIds trong phạm vi | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| HS-15 | Lọc ngày theo giờ Việt Nam, trọn ngày; từ ngày lớn hơn tới ngày ra rỗng | `from`, `to` theo múi giờ VN | eb-08 | chưa có | Video QL-1, **thiếu video** |
| HS-16 | URL lạ: số trang sai, status, passed, check lạ, ngày năm 0001 bị bỏ, không lỗi 500 | parse bỏ giá trị lạ, ngày trước 1900 | eb-06 | chưa có | E2E |
| HS-17 | Chip bỏ đúng một lọc; Esc đóng bảng Bộ lọc, trả focus về nút | FilterChips, FilterPanel | rv-2, eb-06 | chưa có | Video QL-1, **thiếu video** |
| HS-18 | Quay lại của trình duyệt khôi phục bộ lọc | lọc ghi lên URL | eb-07 | chưa có | E2E |
| HS-19 | Lọc Chờ kiểm tra còn 1 dòng ở trang 2, Đạt rồi Quay lại: không có trang rỗng | kẹp số trang | eb-12 | chưa có | E2E |
| HS-20 | Cột Ngân hàng gộp tên và tag ngắn ("Chờ") | BankCell | cb-1 | V5 "Nhân viên quản hai ngân hàng mở hồ sơ ở Trang 3" (kiểm chữ "Chờ") | Video NV-1 |
| HS-21 | Cột Ngân hàng ghi "Chưa chọn" khi học sinh chưa chọn | BankCell rỗng | **chưa có** | chưa có | E2E, **thiếu e2e** |
| HS-22 | "Xác thực ảnh x/y" trong cột Ngân hàng: chỉ khi lượt kiểm xong và người xem quản ngân hàng đó | BankCell + `reviewsBank` | pc-1 | V7 "Trang 3 hiện x/y từng ngân hàng" | Video NV-1, **thiếu video** vai Nhân viên |
| HS-23 | Nhân viên không thấy x/y của ngân hàng không quản | BankCell ẩn x/y | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| HS-24 | Cột Người kiểm: tên người đánh dấu hay "Chưa kiểm" | page.tsx | **chưa có** | V9 "Trang 3 Hồ sơ học sinh: 2 hồ sơ" (hiện trên màn, không kiểm) | Video NV-1, **thiếu e2e**, **thiếu video** |
| HS-25 | Câu rỗng "Chưa có hồ sơ nào." | không có hồ sơ trong phạm vi | eb-09 | chưa có | E2E |
| HS-26 | Câu rỗng "Không có hồ sơ khớp bộ lọc." | có lọc, không khớp | eb-03, eb-04, eb-08, eb-09 | chưa có | E2E |
| HS-27 | Nhân viên chỉ thấy hồ sơ có ngân hàng mình quản, ở trang và API | `customerWhere` tồn tại ngân hàng trong phạm vi | eb-09, cb-1 | chưa có | E2E |
| HS-28 | Tên 100 ký tự, tên liền ở 1366 và 390 px không tràn ngang | CSS | eb-01, mb-1 | chưa có | E2E |
| HS-29 | Nhân viên chưa được giao ngân hàng: menu ẩn, trang 404, API 403 | `requirePage`, `requireApi` | eb-09, cs-2 | chưa có | E2E |
| HS-30 | Quản lý thấy mọi hồ sơ, mọi ngân hàng | `customerScope` tất cả | **chưa có** (cs-2 chỉ kiểm menu có `/customers`) | chưa có | Video QL-1, **thiếu e2e**, **thiếu video** |
| HS-31 | Nhân viên chỉ có `manage_banks`, chưa được giao ngân hàng: không có `/customers` | `can customers` cần `managedBankIds` | **chưa có** (cs-2 không có vai này) | chưa có | E2E, **thiếu e2e** |

### F2 Chi tiết hồ sơ học sinh

Nguồn: `src/app/admin/(shell)/customers/[id]/page.tsx`, `src/server/customerDetail.ts`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| CT-01 | Thẻ Thông tin: Họ tên, Lớp, Trường, SĐT, Phụ huynh, SĐT phụ huynh | page.tsx | rv-1, ebd-02 | V5 "Nhân viên quản hai ngân hàng mở hồ sơ ở Trang 3" (chỉ kiểm tiêu đề) | Video NV-1 |
| CT-02 | SĐT phụ huynh là link `tel:` | page.tsx | **chưa có** | chưa có | E2E, **thiếu e2e** |
| CT-03 | Dòng "Đã có TK" liệt kê ngân hàng học sinh đã có tài khoản | page.tsx | **chưa có** | chưa có | E2E, **thiếu e2e** |
| CT-04 | Dòng "Gửi lúc" ("Chưa gửi") và "Mở web lần cuối" ("Chưa có") | page.tsx | **chưa có** | chưa có | E2E, **thiếu e2e** |
| CT-05 | Hồ sơ trùng cùng tên và SĐT trong phạm vi, có link sang hồ sơ kia | `getCustomerDetail` duplicates | ebd-21 | chưa có | Video NV-1, **thiếu video** |
| CT-06 | "Không có hồ sơ cùng tên và SĐT" | không có hồ sơ trùng | **chưa có** | chưa có | E2E, **thiếu e2e** |
| CT-07 | Hồ sơ chưa chọn ngân hàng chỉ có thẻ Thông tin và SMS | không có dòng ngân hàng | ebd-21 | chưa có | E2E |
| CT-08 | Meta thẻ ngân hàng: "Ngân hàng N - Mã giới thiệu X - Người quản ..." | BankCard | **chưa có** | chưa có | E2E, **thiếu e2e** |
| CT-09 | Ảnh từng khung; khung chưa có ảnh ghi "Chưa có ảnh" | BankCard slots | rv-1, ebd-21 | V5 "Xem ảnh từng khung và khối Xác thực ảnh" | Video NV-1 |
| CT-10 | Khung đã bị gỡ vẫn hiện khi dòng còn ảnh của khung đó | slot đã bỏ còn ảnh | **chưa có** (ebd-13 chỉ kiểm Đạt được) | chưa có | E2E, **thiếu e2e** |
| CT-11 | Thẻ ngân hàng không quản: không ghi chú, khung ảnh, ảnh, kết quả kiểm, nút | `reviewsBank` false | rv-1, ebd-19 | chưa có | Video NV-3, **thiếu video** |
| CT-12 | Khung có ảnh thay ghi "Ảnh thay thế của X" | ảnh do nhân viên tải | ebd-11 | chưa có | Video NV-2, **thiếu video** |
| CT-13 | Dòng "X đánh dấu lúc ..." sau khi đánh dấu | reviewedBy, reviewedAt | **chưa có** | chưa có | Video NV-1, **thiếu e2e**, **thiếu video** |
| CT-14 | Khối SMS sau lần Đạt đầu: mã voucher, ngày cấp, gửi tới, tag Chưa gửi | `sms_messages` | rv-1 | V5 "Đánh dấu Đạt ngân hàng 1, voucher hiện ở khối SMS"; V6 "Ngân hàng đầu Đạt: tin SMS cho phụ huynh đang chờ gửi" | Video NV-1 |
| CT-15 | Khối SMS tag Đã gửi, Lỗi kèm "Lần gửi n/3" và câu lỗi | `status`, `attempts`, `error` | sm-2 (câu lỗi dài ở chi tiết); tag Đã gửi ở Trang 4 chưa kiểm | chưa có | E2E |
| CT-16 | Voucher cấp 23:45 ngày 31/10 hiện đúng giờ Việt Nam | format giờ VN | ebd-21 | chưa có | E2E |
| CT-17 | Chữ dài và thẻ HTML ở 1366 và 390 px | CSS, React escape | ebd-01, ebd-02 | chưa có | E2E |
| CT-18 | Id không phải uuid, uuid không có: 404 ở trang, API, route ảnh | `notFound`, 404 | ebd-03 | chưa có | E2E |
| CT-19 | Nhân viên mở hồ sơ ngoài phạm vi: 404 ở trang và mọi API | `getCustomerDetail` trả null | ebd-19 | chưa có | E2E |
| CT-20 | Nút quay lại ở thanh tiêu đề về danh sách | TopBar back | **chưa có** | chưa có | Video NV-1, **thiếu e2e**, **thiếu video** |

### F3 Sửa thông tin

Nguồn: `src/server/customerDetail.ts` (`updateCustomerInfo`), `src/lib/customerForm.ts` (`CustomerEditForm`).

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| SU-01 | Sửa họ tên, lớp, phụ huynh, SĐT rồi Lưu; trang hiện dữ liệu mới; ghi audit `update_customer` | `updateCustomerInfo` ok | ebd-04 | chưa có | Video NV-2, **thiếu video** |
| SU-02 | Ô trống, chỉ khoảng trắng, quá 100 hay 20 ký tự báo đúng ô | zod "Nhập họ và tên", "Tối đa 100 ký tự", "Nhập lớp", "Tối đa 20 ký tự", "Nhập họ và tên phụ huynh" | ebd-04 | chưa có | E2E |
| SU-03 | SĐT sai dạng; SĐT phụ huynh trùng SĐT học sinh | "SĐT phải có 10 số, bắt đầu bằng 0.", "SĐT phụ huynh phải khác SĐT học sinh." | ebd-04 | chưa có | E2E |
| SU-04 | Lớp bỏ khoảng trắng và viết hoa; SĐT bỏ dấu cách | transform zod | ebd-04 ("12 a1", "0912 345 678") | chưa có | E2E |
| SU-05 | Ký tự điều khiển, nửa cặp surrogate | zod | ebd-05 | chưa có | E2E |
| SU-06 | Bấm Lưu hai lần chỉ gửi một request; đang gửi thì Huỷ khoá | dialog pending | ebd-04, ebd-06 | chưa có | E2E |
| SU-07 | Hồ sơ đã có voucher: nút Sửa thông tin ẩn | `canEdit = !voucher` | rv-1 | chưa có (V5 không kiểm) | Video NV-1, **thiếu video** |
| SU-08 | Tab B đang sửa khi tab A đã Đạt: 409 "Hồ sơ đã có voucher, không sửa được thông tin." | 409 | ebd-10 | chưa có | E2E |
| SU-09 | Đổi họ tên thì xếp lại lượt kiểm ảnh cho dòng Chờ kiểm tra, Không đạt có khung `checkName` | `queuePhotoChecks` | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| SU-10 | Nhân viên bị bỏ giao ngân hàng lúc hộp đang mở: báo không tìm thấy ở dòng báo chung | 404 "Không tìm thấy hồ sơ." | ebd-20 | chưa có | E2E |
| SU-11 | Mất mạng khi Lưu thông tin | fetch lỗi | **chưa có** | chưa có | E2E, **thiếu e2e** |
| SU-12 | Ngoài phạm vi: 404; thiếu Origin: 403 | `requireApi` | ebd-19 | chưa có | E2E |

### F4 Hậu kiểm Đạt, Không đạt, cấp voucher

Nguồn: `src/server/review.ts`, `src/lib/reviewForm.ts`, `src/components/customers/ReviewActions.tsx`, `src/server/voucher.ts`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| HK-01 | Đạt dòng Chờ kiểm tra: hộp "Đánh dấu Đạt cho X?", lần Đạt đầu cấp voucher và thêm tin SMS | `!firstPassedAt`, insert `sms_messages`, `pg_notify` | rv-1, ebd-16 | V5 "Đánh dấu Đạt ngân hàng 1, voucher hiện ở khối SMS" | Video NV-1 |
| HK-02 | Không đạt dòng Chờ kiểm tra | result failed | ebd-15, ebd-17 | V5 "Đánh dấu Không đạt ngân hàng 2" | Video NV-1 |
| HK-03 | Đổi Không đạt sang Đạt | failed sang passed | ebd-17 | V5 "Đổi Không đạt sang Đạt, không cấp thêm voucher" | Video NV-1 |
| HK-04 | Ngân hàng thứ hai Đạt: không cấp voucher mới | `firstPassedAt` đã có | V5 (flow) | V5 "Đổi Không đạt sang Đạt, không cấp thêm voucher" | Video NV-1 |
| HK-05 | Hết dòng Chờ kiểm tra thì hồ sơ sang Đã kiểm tra | cập nhật `customers.status` reviewed | eb-12 | chưa có | Video NV-1, **thiếu video** |
| HK-06 | Nút theo trạng thái: Đạt ở Chờ kiểm tra và Không đạt; Không đạt chỉ ở Chờ kiểm tra; dòng Đạt không có nút | ReviewActions | V5 (flow, đếm nút sau mỗi bước) | V5 "Đánh dấu Không đạt ngân hàng 2" | Video NV-1 |
| HK-07 | API review dòng Đạt: 409 "Ngân hàng đã Đạt, không đổi được kết quả." | `transitionError` passed | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| HK-08 | API review dòng Đang tạo: 409 "Học sinh chưa gửi kiểm tra." | `transitionError` selected | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| HK-09 | API Không đạt dòng Không đạt: 409 "Ngân hàng đã Không đạt, chỉ đổi được sang Đạt." | `transitionError` failed | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| HK-10 | Hai tab: người khác đánh dấu trước: 409 "Ngân hàng này đã có người đánh dấu. Tải lại trang để xem kết quả mới." | TAKEN | ebd-10, ebd-16, ebd-17 | chưa có | Video NV-5, **thiếu video** |
| HK-11 | Ảnh vừa được thay: 409 "Ảnh vừa được thay. Tải lại trang để xem ảnh mới.", không cấp voucher; tải lại thì Đạt được | STALE_PHOTOS khi Đạt kèm `photos` | ebd-11, ebd-14 | chưa có | Video NV-5, **thiếu video** |
| HK-12 | Mạng chậm: tự tải ảnh rồi Đạt ngay không báo ảnh vừa được thay | `photos` gửi theo ảnh mới | ebd-12 | chưa có | E2E |
| HK-13 | Mạng chậm: Không đạt rồi Đạt ngay | expected theo trạng thái mới | ebd-15 | chưa có | E2E |
| HK-14 | Khung bị gỡ lúc trang đang mở vẫn Đạt được | ảnh khung cũ vẫn dùng | ebd-13 | chưa có | E2E |
| HK-15 | Không đạt không xét ảnh vừa thay | STALE chỉ xét khi Đạt | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| HK-16 | Bấm đúp nút Đạt chỉ gửi một request | dialog pending | ebd-18 | chưa có | E2E |
| HK-17 | Hộp đang gửi: Huỷ khoá, Esc 4 lần, `dialog.close()` không đóng; 409 hiện trong hộp | ConfirmDialog | ebd-06, ebd-07 | chưa có | E2E |
| HK-18 | Thiếu `VOUCHER_SECRET`: 500 | review.ts | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| HK-19 | Mã voucher trùng: thử lại tối đa 5 lượt bằng savepoint | review.ts | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| HK-20 | Hai ngân hàng của một hồ sơ Đạt cùng lúc: chỉ 1 voucher | khoá dòng hồ sơ | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| HK-21 | Nhân viên bị bỏ giao ngân hàng rồi bấm Đạt: 404 | NOT_FOUND "Không tìm thấy ngân hàng của hồ sơ." | **chưa có** (có test DB DB-04; ebd-20 không phủ nút Đạt) | chưa có | E2E, **thiếu e2e** |
| HK-22 | Nhân viên gọi review dòng ngân hàng không quản: 404; thiếu Origin: 403 | `reviewsBank`, `requireApi` | ebd-19 | chưa có | E2E |
| HK-23 | Body sai: result lạ ("Chọn Đạt hoặc Không đạt."), `photos` quá 50 hay không phải uuid: 400 | `ReviewForm` | **chưa có** | chưa có | E2E, **thiếu e2e** |
| HK-24 | Quản lý hậu kiểm thay Nhân viên | `reviewsBank` tất cả | **chưa có** | chưa có | Video QL-1, **thiếu e2e**, **thiếu video** |
| HK-25 | Ghi `review_events` và audit | review.ts | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| HK-26 | Mã voucher dạng viết tắt trường - chữ đầu họ tên - lớp - 4 ký tự | `voucher.ts` | rv-1 (regex), V5 (regex) | V5 "Đánh dấu Đạt ngân hàng 1, voucher hiện ở khối SMS" | E2E |

### F5 Ghi chú nội bộ

Nguồn: `src/server/review.ts` (`saveNote`), `src/lib/reviewForm.ts` (`NoteForm`).

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| GC-01 | Thêm, sửa ghi chú; thẻ hiện ghi chú; chưa có thì "Chưa có ghi chú" | `saveNote` ok | ebd-05, ebd-21 | chưa có | Video NV-2, **thiếu video** |
| GC-02 | Ô chặn 1.000 ký tự; API từ chối 1.001 "Ghi chú tối đa 1000 ký tự"; cắt khoảng trắng đầu cuối | zod | ebd-05 | chưa có | E2E |
| GC-03 | Ký tự điều khiển: "Có ký tự không hợp lệ" | zod | ebd-05 | chưa có | E2E |
| GC-04 | Hai tab cùng sửa: người lưu sau thắng | ghi đè | ebd-05 | chưa có | E2E |
| GC-05 | Ghi chú sửa được ở dòng Đạt và Không đạt | không xét trạng thái | **chưa có** | chưa có | E2E, **thiếu e2e** |
| GC-06 | Ghi chú dài, có thẻ HTML hiện nguyên văn | CSS, React escape | ebd-01, ebd-02 | chưa có | E2E |
| GC-07 | Mất mạng: câu báo ở dòng báo chung | NoteDialog | ebd-05 | chưa có | E2E |
| GC-08 | Bị bỏ giao ngân hàng lúc hộp mở: 404 ở dòng báo chung | 404 | ebd-20 | chưa có | E2E |
| GC-09 | Đang gửi thì Huỷ khoá, Esc không đóng | dialog pending | ebd-06 | chưa có | E2E |

### F6 Tải ảnh thay thế

Nguồn: `src/server/review.ts` (`replacePhoto`), `src/app/api/admin/customer-banks/[id]/photos/route.ts`, ReplaceDialog trong `ReviewActions.tsx`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| TA-01 | Chọn khung, chọn ảnh, tải lên: khung hiện ảnh mới "Ảnh thay thế của X" | `replacePhoto` ok, `putImage` đổi WebP | ebd-11 | chưa có | Video NV-2, **thiếu video** |
| TA-02 | Ngân hàng có khung kiểm: Xác thực ảnh về "Đang kiểm" | `queuePhotoChecks` | **chưa có** (có test DB) | chưa có | Video NV-2, **thiếu e2e**, **thiếu video** |
| TA-03 | Không chọn file "Chọn ảnh.", 0 byte, file chữ đổi đuôi, 21 và 23 MB "Ảnh lớn hơn 20 MB.", Nginx 413 | route + ReplaceDialog | ebd-08 | chưa có | E2E |
| TA-04 | `slotId` sai "Chọn khung ảnh."; khung bị gỡ lúc hộp mở: 404 "Không tìm thấy khung ảnh." ở ô Khung ảnh | route, `replacePhoto` | ebd-09 | chưa có | E2E |
| TA-05 | Dòng Đạt: 409 "Ngân hàng đã Đạt, không thay được ảnh." | `replacePhoto` passed | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| TA-06 | Dòng Không đạt thay ảnh được | `replacePhoto` failed | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| TA-07 | Dòng Đang tạo: 409 "Học sinh chưa gửi kiểm tra." | `transitionError` selected | **chưa có** | chưa có | E2E, **thiếu e2e** |
| TA-08 | Ngân hàng không có khung ảnh: không có nút "Tải ảnh thay thế" | `slots.length > 0` | **chưa có** | chưa có | E2E, **thiếu e2e** |
| TA-09 | Ảnh hỏng: 400 gắn ô file; lỗi sau khi tải thì xoá object S3 vừa tải | `putImage` lỗi, cleanup | ebd-08 (file chữ đổi đuôi) | chưa có | E2E |
| TA-10 | Ảnh HEIC khi thay ảnh | `putImage` HEIC | **chưa có** (plan ghi chưa test được) | chưa có | E2E, **thiếu e2e** |
| TA-11 | Hai tab cùng tải một khung: người tải sau ghi đè | ghi đè | ebd-14 | chưa có | E2E |
| TA-12 | Mất mạng: câu báo chung | ReplaceDialog | ebd-08 | chưa có | E2E |
| TA-13 | Bị bỏ giao ngân hàng lúc hộp mở: 404 ở dòng báo chung | 404 | ebd-20 | chưa có | E2E |

### F7 Xem ảnh

Nguồn: `src/server/customerDetail.ts` (`photoForView`), `src/app/api/admin/photos/[id]/route.ts`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| XA-01 | Bấm ảnh mở tab mới xem ảnh đủ cỡ | link `/api/admin/photos/id` | rv-1 | V5 "Xem ảnh từng khung và khối Xác thực ảnh" (chỉ kiểm ảnh tải xong, chưa mở tab) | Video NV-1, **thiếu video** bước mở tab |
| XA-02 | Ảnh ngân hàng không quản: không hiện, route 404 "Không tìm thấy ảnh." | `reviewsBank` false | rv-1, ebd-19 | chưa có | E2E |
| XA-03 | Id ảnh sai: 404 | `notFound` | ebd-03 | chưa có | E2E |
| XA-04 | Ảnh của người tải trước vẫn mở được sau khi bị ghi đè | object cũ còn | ebd-14 | chưa có | E2E |
| XA-05 | Xem ảnh không ghi audit | route | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |

### F8 Kiểm ảnh tự động

Nguồn: `src/server/photoChecks.ts`, `src/server/photoCheckWorker.ts`, `src/server/ocr/judge.ts`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| KA-01 | Học sinh gửi kiểm tra: xếp lượt cho ngân hàng có khung `checkName` hay `checkCode` | `submitForReview` gọi `queuePhotoChecks` | pc-1 | V7 "Ảnh học sinh nộp lưu ở dạng WebP, chưa kiểm" | E2E |
| KA-02 | Ngân hàng không có khung kiểm: không xếp lượt, không có khối Xác thực ảnh | không có khung kiểm | **chưa có** | chưa có | E2E, **thiếu e2e** |
| KA-03 | Lượt chưa xong: "Đang kiểm" | pending | V5 (flow) | V5 "Xem ảnh từng khung và khối Xác thực ảnh" | E2E |
| KA-04 | Kiểm xong: từng khung Đạt hay Không đạt, lý do, "Hệ thống: ..." | done | pc-1 | V7 "Trang 4 hiện kết quả từng khung" | Video NV-1 (V7 là vai Quản trị, có bước worker) |
| KA-05 | Thiếu cả họ tên và mã: "Không tìm thấy họ tên X và mã giới thiệu Y trong ảnh." | `judge.ts` | pc-1 | V7 "Trang 4 hiện kết quả từng khung" | Video NV-1 |
| KA-06 | Thiếu chỉ họ tên hay chỉ mã; Đạt ghi "Họ tên", "Mã giới thiệu" hay cả hai | `judge.ts` | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| KA-07 | Khung kiểm chưa có ảnh: "Chưa có ảnh." | `judge.ts` | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| KA-08 | Mã giới thiệu rỗng thì không kiểm mã | `judge.ts` | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| KA-09 | Lỗi kiểm: "Không kiểm được" kèm lỗi ở Trang 4 | failed | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| KA-10 | Máy kiểm dừng giữa chừng 3 lần: "Máy kiểm ảnh dừng giữa chừng 3 lần với lượt này." | claim hết hạn 5 phút, `MAX_CLAIMS` 3 | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| KA-11 | Lượt bị thay trong lúc kiểm (ảnh mới, tên mới): bỏ kết quả cũ | dropped | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| KA-12 | Không còn khung kiểm: xoá lượt | xoá | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| KA-13 | Ảnh HEIC đổi JPEG; HEIC quá lớn thì lỗi | worker | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| KA-14 | Ảnh mất trên S3: lượt lỗi | worker | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| KA-15 | Kết quả kiểm không đổi trạng thái dòng ngân hàng | worker | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |

### F9 Trang Ngân hàng nhóm Nghiệp vụ

Nguồn: `src/app/admin/(shell)/customer-banks/page.tsx`, `src/server/customerBankList.ts`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| NH-01 | Mỗi ngân hàng học sinh chọn ra một dòng | một dòng một `customer_banks` | cb-1 | V10 "Quản trị mở trang Ngân hàng trong nhóm Nghiệp vụ"; V10 "Tìm theo tên: học sinh chọn 2 ngân hàng ra 2 dòng" | Video QL-2 |
| NH-02 | Lọc theo trường qua ô tìm trường, chip Trường | `school` | nh-1, nh-2 | V10 "Lọc theo trường" | Video QL-2 |
| NH-03 | Ô tìm trường có cả trường đã đóng | `/api/admin/customer-banks/schools` | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| NH-04 | Ô tìm trường nhận %, _, NUL; Esc chỉ đóng gợi ý | escape, combobox | nh-2, cb-2 | chưa có | E2E |
| NH-05 | Lọc nhiều ngân hàng; nút Bộ lọc đếm 1 mục | `bank` nhiều giá trị | cb-1, cb-3 | V10 "Lọc theo ngân hàng rồi bỏ lọc" | Video QL-2 |
| NH-06 | Id ngân hàng ngoài phạm vi trên URL bị bỏ | lọc bankIds | nh-2 | chưa có | E2E |
| NH-07 | Lọc trạng thái Đang tạo, Chờ kiểm tra, Đạt, Không đạt | `status` | cb-1 (Đang tạo), nh-4 (Chờ kiểm tra); Đạt, Không đạt chưa kiểm | chưa có | Video QL-2, **thiếu video** |
| NH-08 | Lọc Xác thực ảnh Đủ, Thiếu | `check` | **chưa có** (nh-2 chỉ thử `check=x`) | chưa có | Video QL-2, **thiếu e2e**, **thiếu video** |
| NH-09 | Cột Xác thực ảnh: "Chưa có", "Đang kiểm", "Không kiểm được", x/y; màu xanh khi đạt hết, cam khi từ nửa, đỏ khi dưới nửa | CheckCell | **chưa có** | chưa có | Video NV-3, **thiếu e2e**, **thiếu video** |
| NH-10 | Tìm nhiều từ, SĐT | `likeEachTerm`, SĐT | nh-3 | V10 "Tìm theo tên: học sinh chọn 2 ngân hàng ra 2 dòng" | Video QL-2 |
| NH-11 | 17 dòng ra 15 và 2; đổi chiều Ngày giữ tìm và lọc, về trang 1 | `dir` asc, desc | nh-3 | chưa có | Video QL-2, **thiếu video** |
| NH-12 | Lọc ngày trọn ngày giờ Việt Nam | `from`, `to` | nh-3 | chưa có | E2E |
| NH-13 | URL lạ: NUL, ngân hàng sai, trường không có, trạng thái lạ, chiều lạ, trang lạ không lỗi 500 | parse bỏ giá trị lạ | nh-2 | chưa có | E2E |
| NH-14 | Lọc Chờ kiểm tra còn 1 dòng ở trang 2, Đạt rồi Quay lại: không có trang rỗng | kẹp số trang | nh-4 | chưa có | E2E |
| NH-15 | Nhân viên chỉ thấy dòng ngân hàng mình quản; quản một ngân hàng thì không có mục lọc Ngân hàng | phạm vi bankIds; `banks.length <= 1` | cb-1, nh-5 | V10 "Nhân viên quản VPBank chỉ thấy dòng VPBank, không có mục lọc Ngân hàng" | Video NV-3 |
| NH-16 | Câu rỗng "Chưa có học sinh chọn ngân hàng." và "Không có dòng nào khớp bộ lọc." | rỗng | nh-5 | chưa có | E2E |
| NH-17 | Bấm tên ngân hàng mở Trang 4 của học sinh | link | V10 (flow) | V10 "Bấm tên ngân hàng mở Trang 4 của học sinh" (vai Quản trị) | Video NV-3 |
| NH-18 | Tên dài, chip Trường dài ở 1366 và 390 px | CSS | nh-1 | chưa có | E2E |
| NH-19 | Nhân viên chưa được giao ngân hàng: menu ẩn, 404 | `requirePage` | cs-2 | chưa có | E2E |
| NH-20 | Quản lý thấy mọi dòng | phạm vi tất cả | **chưa có** (cs-2 chỉ kiểm menu) | chưa có | Video QL-2, **thiếu e2e**, **thiếu video** |

### F10 Mã voucher

Nguồn: `src/app/admin/(shell)/vouchers/page.tsx`, `src/server/vouchers.ts`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| VC-01 | Danh sách mã: mã, họ tên, trường, ngày cấp | page.tsx | rv-1 | V5 "Voucher hiện ở Trang 12 Mã voucher"; V9 "Trang 12 Mã voucher: 2 mã" | Video QL-3 |
| VC-02 | Tìm mã một phần chữ thường, họ tên không dấu, nhiều từ | tìm mã hay họ tên từng từ | vc-1 | chưa có | Video QL-3, **thiếu video** |
| VC-03 | Lọc ngày cấp trọn ngày giờ Việt Nam | `from`, `to` | vc-2 | chưa có | Video QL-3, **thiếu video** |
| VC-04 | 16 mã ra 15 và 1 | phân trang | vc-1 | chưa có | E2E |
| VC-05 | URL lạ không lỗi 500; khổ 390 không tràn ngang | parse | vc-1 | chưa có | E2E |
| VC-06 | "Không có mã khớp bộ lọc." | rỗng có lọc | vc-1 | chưa có | E2E |
| VC-07 | "Chưa cấp mã voucher nào." | rỗng không lọc | **chưa có** | chưa có | E2E, **thiếu e2e** |
| VC-08 | Quản trị, Quản lý bấm tên mở Trang 4 | tên là link khi phạm vi tất cả | **chưa có** (vc-4 chỉ kiểm phía không link) | chưa có | Video QL-3, **thiếu e2e**, **thiếu video** |
| VC-09 | Nhân viên có `vouchers` nhưng phạm vi theo ngân hàng: tên không thành link | `customerScope` theo bankIds | vc-4 | chưa có | E2E |
| VC-10 | Thiếu quyền `vouchers`: menu ẩn, 404 trang, 403 xuất | `requirePage`, `requireApi` | vc-4, cs-2 | chưa có | E2E |

### F11 Worker gửi SMS

Nguồn: `src/server/sms/queue.ts`, `src/server/sms/send.ts`, `scripts/sms-worker.ts`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| SW-01 | Lần Đạt đầu thêm tin chờ gửi và `pg_notify`; worker nghe LISTEN rồi gửi | queue | V6 (flow) | V6 "Ngân hàng đầu Đạt: tin SMS cho phụ huynh đang chờ gửi"; V6 "Worker SMS chạy một vòng: gửi tin, ghi log" | E2E (người xem chỉ thấy tag Đã gửi, không quay worker) |
| SW-02 | Gửi xong: tin sang Đã gửi, ghi giờ gửi | sent | V6 (flow) | V6 "Worker SMS chạy một vòng: gửi tin, ghi log" | E2E |
| SW-03 | Nhà mạng từ chối: giữ chờ gửi, tăng lần gửi; lần 3 sang Lỗi, câu lỗi cắt 500 ký tự | `MAX_ATTEMPTS` 3 | V6 (flow), sm-2 | V6 "Học sinh thứ hai Đạt; nhà mạng từ chối số phụ huynh 3 lần" | E2E |
| SW-04 | Quét lại mỗi 30 giây khi lỡ notify | worker | **chưa có** | chưa có | E2E, **thiếu e2e** |
| SW-05 | Hai worker cùng chạy không gửi trùng | `skipLocked` | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| SW-06 | Cờ `--truong=` chỉ gửi tin của một trường | worker | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| SW-07 | Tin đang gửi thì lỗi giữa chừng | worker | **chưa có** (plan ghi chưa test được) | chưa có | E2E, **thiếu e2e** |

### F12 Tin SMS lỗi và Gửi lại

Nguồn: `src/app/admin/(shell)/sms/page.tsx`, `src/server/sms/queue.ts` (`resendSms`, `failedSmsCount`), `src/lib/smsFilters.ts`, `ResendButton.tsx`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| SL-01 | Menu Tin SMS lỗi có badge số tin lỗi | `failedSmsCount` | V6 (flow) | V6 "Tin SMS lỗi: sidebar đếm tin lỗi, bảng ghi lỗi và 3/3 lần gửi" | Video NV-4 (V6 là vai Quản trị) |
| SL-02 | Badge của Nhân viên chỉ đếm tin trong phạm vi | `failedSmsCount` theo phạm vi | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| SL-03 | Mặc định lọc Lỗi; cột Gửi lúc, Họ tên, Trường, SĐT nhận, Lỗi, Lần gửi, Trạng thái, Thao tác | `smsFilters` mặc định failed | sm-1, V6 (flow) | V6 "Tin SMS lỗi: sidebar đếm tin lỗi, bảng ghi lỗi và 3/3 lần gửi" | Video NV-4 |
| SL-04 | Bỏ chip ghi `status=all`; lọc Đã gửi, Đang gửi | `smsFilters` | sm-6 (lọc Đã gửi không khớp) | chưa có | Video NV-4, **thiếu video** |
| SL-05 | Gửi lại: sửa SĐT nhận, tin về chờ gửi, lần gửi về 0 | `resendSms` ok | sm-3, V6 (flow) | V6 "Sửa SĐT nhận, bấm Gửi lại" | Video NV-4 |
| SL-06 | Worker gửi lại tới số mới: tin sang Đã gửi | worker | V6 (flow) | V6 "Worker gửi lại tới số mới: tin sang Đã gửi" | Video NV-4 |
| SL-07 | SĐT trống, sai dạng: "SĐT phải có 10 số, bắt đầu bằng 0." ở ô; SĐT có dấu cách được chuẩn hoá; Huỷ rồi mở lại hiện SĐT đang lưu; Enter gửi | zod, 400 field `toPhone` | sm-3 | chưa có | E2E |
| SL-08 | Đang Gửi lại: Huỷ khoá, Esc 4 lần không đóng | dialog pending | sm-4 | chưa có | E2E |
| SL-09 | Hai tab: tab sau 409 "Tin này không ở trạng thái lỗi." ở dòng báo chung; đóng hộp thì bảng tải lại | 409, stale | sm-5 | chưa có | E2E |
| SL-10 | Mất mạng: đóng hộp không tải lại trang | ResendButton | sm-5 | chưa có | E2E |
| SL-11 | Gửi lại dòng cuối của trang cuối: về trang còn dòng | kẹp số trang | sm-1 | chưa có | E2E |
| SL-12 | Tìm nhiều từ, SĐT có dấu cách; 16 tin ra 15 và 1; URL lạ, trạng thái lạ về Lỗi | parse | sm-1 | chưa có | E2E |
| SL-13 | Cột Lỗi 500 ký tự liền không tràn ngang ở 1366 và 390 px | CSS | sm-2 | chưa có | E2E |
| SL-14 | Câu rỗng "Không có tin lỗi.", "Không có tin khớp bộ lọc.", "Chưa có tin nào." | rỗng | sm-6 | chưa có | E2E |
| SL-15 | Nhân viên không thấy và không Gửi lại được tin ngoài phạm vi: 404 "Không tìm thấy tin SMS." | phạm vi | sm-6 | chưa có | E2E |
| SL-16 | Bị bỏ giao ngân hàng lúc hộp Gửi lại mở: báo không tìm thấy | 404 | ebd-20 | chưa có | E2E |
| SL-17 | Bấm tên học sinh mở Trang 4 | link | **chưa có** | chưa có | E2E, **thiếu e2e** |
| SL-18 | Chưa được giao ngân hàng: menu ẩn, 404 | `requirePage("customers")` | cs-2 | chưa có | E2E |

### F13 Xuất Excel

Nguồn: `src/server/exports.ts`, route `src/app/api/admin/{customers,customer-banks,vouchers}/export/route.ts`, `ExportButton.tsx`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| XE-01 | Xuất hồ sơ học sinh theo bộ lọc; đầu bảng 3 tầng HỌC SINH, NGÂN HÀNG 1, NGÂN HÀNG 2, VOUCHER | exports.ts | eb-10, V9 (flow) | V9 "Trang 3 Hồ sơ học sinh: 2 hồ sơ" | Video QL-4 |
| XE-02 | Xuất trang Ngân hàng, có cột XÁC THỰC ẢNH | exports.ts | nh-6, V9 (flow) | V9 "Trang Ngân hàng: mỗi ngân hàng học sinh chọn một dòng, 4 dòng" | Video QL-4 |
| XE-03 | Xuất Mã voucher | exports.ts | vc-5, V9 (flow) | V9 "Trang 12 Mã voucher: 2 mã" | Video QL-4 |
| XE-04 | Không có dòng nào vẫn tải được | exports.ts | eb-10, nh-6, vc-5 | chưa có | E2E |
| XE-05 | Chuỗi bắt đầu bằng = + - @ là chữ; SĐT giữ số 0; tên 100 ký tự giữ nguyên | exports.ts | eb-10, nh-6, vc-5 | chưa có | E2E |
| XE-06 | Lọc trọn ngày giờ Việt Nam; cột giờ ghi đúng | exports.ts | eb-11, nh-7, vc-3 | chưa có | E2E |
| XE-07 | Nhân viên xuất hồ sơ theo phạm vi ngân hàng | phạm vi | eb-09 | chưa có | E2E |
| XE-08 | Nhân viên xuất trang Ngân hàng theo phạm vi; thiếu quyền thì 403 | phạm vi, 403 | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |
| XE-09 | Thiếu `export_excel`: nút ẩn, 403 "Không có quyền xuất Excel." | `can export_excel` | eb-09 | chưa có | E2E |
| XE-10 | Có `vouchers` mà không có `export_excel`: nút ẩn ở Mã voucher | `can export_excel` | **chưa có** | chưa có | E2E, **thiếu e2e** |
| XE-11 | Quá 20.000 dòng: 400 "Danh sách có N dòng, quá 20000 dòng một file. Lọc bớt rồi xuất lại." | `EXPORT_LIMIT` | **chưa có** (có test DB DB-06) | chưa có | E2E, **thiếu e2e** |
| XE-12 | Câu lỗi xuất nằm trọn màn hình ở 360 và 390 px | ExportButton | mb-2 (giả lỗi 400) | chưa có | E2E |
| XE-13 | Mất mạng: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." cạnh nút | ExportButton | **chưa có** | chưa có | E2E, **thiếu e2e** |
| XE-14 | Tên file theo ngày Việt Nam: `ho-so-hoc-sinh-`, `ngan-hang-`, `ma-voucher-` | exports.ts | **chưa có** (có test DB DB-05; V9 chỉ in tên file ra note) | V9 note in tên file | E2E, **thiếu e2e** |
| XE-15 | Ghi audit lượt xuất | exports.ts | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |

### F14 Vận hành hệ thống

Nguồn: `src/app/admin/(shell)/ops/page.tsx`, `src/server/ops.ts`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| VH-01 | Khối Máy chủ 4 ô: CPU, RAM, Ổ đĩa, S3 | ops.ts | op-1 | V8 "Xem Trang 18 Vận hành hệ thống" | Video QT-1 |
| VH-02 | Chưa có số đo: "Chưa có số đo." | không có dòng đo | **chưa có** | chưa có | E2E, **thiếu e2e** |
| VH-03 | S3 chưa đo: "Chưa đo" | S3 null | **chưa có** (V8 chạy với S3 tắt nhưng không kiểm chữ) | chưa có | E2E, **thiếu e2e** |
| VH-04 | Ô quá 80%: tag "Vượt 80%" | ResourceCell | **chưa có** | chưa có | Video QT-1, **thiếu e2e**, **thiếu video** |
| VH-05 | Khối Kiểm ảnh: số lượt đang đợi, "Lượt đợi lâu nhất" ("Không có") | ops.ts | op-1 | V8 "Xem Trang 18 Vận hành hệ thống" | Video QT-1 |
| VH-06 | Bảng 7 ngày theo ngân hàng: Đang đợi, Đạt, Không đạt, Lỗi kiểm có số đúng | ops.ts | **chưa có** (op-1 chỉ kiểm tên cột; có test DB) | chưa có | Video QT-1, **thiếu e2e**, **thiếu video** |
| VH-07 | Bảng rỗng: "Chưa có lượt kiểm nào trong 7 ngày." | rỗng | **chưa có** | chưa có | E2E, **thiếu e2e** |
| VH-08 | Trang tự tải lại mỗi 60 giây | AutoRefresh | **chưa có** | chưa có | E2E, **thiếu e2e** |
| VH-09 | Quản lý, Nhân viên: menu ẩn, 404 | `can system` | op-2, cf-1, cs-2 | chưa có | E2E |
| VH-10 | Dọn số đo cũ | ops-watch | **chưa có** (có test DB) | chưa có | E2E, **thiếu e2e** |

### F15 Trang tổng quan

Nguồn: `src/app/admin/(shell)/page.tsx`.

| Mã | Ca | Nhánh trong code | E2E | Video | Đề xuất |
|---|---|---|---|---|---|
| TQ-01 | Quản trị, Quản lý mở `/` thì về `/users` | redirect | cs-1 | chưa có | E2E |
| TQ-02 | Nhân viên mở `/` thì về `/profile` | redirect | cs-1 | chưa có | E2E |

## 4. Đề xuất video theo người xem

Luật chung cho mọi video dưới đây:
- Video quay ở 1366x768 vì nhân viên hậu kiểm, Quản lý và Quản trị dùng máy tính. Bước điện thoại đã có ở V11.
- Bước chạy worker (kiểm ảnh, gửi SMS) phải chạy ngoài khung quay. Người xem chỉ thấy kết quả trên màn.
- Video phải bỏ `note()` kỹ thuật: log worker SMS (V6), khoá S3 (V7), tên file và tầng đầu bảng (V9).
- Video phải tắt overlay góc trái trên (tên file, tên test) và góc phải dưới (locator tiếng Anh). Plan `docs/plans/2026-11-05-e2e-video.md` còn ghi việc này là việc để lại.
- Tên bước hiện trên video không được dùng "Trang 3", "Trang 4", "Trang 12", "Trang 18", "worker", "x/y", "e2e". Tên bước phải dùng tên menu như "Hồ sơ học sinh", "Mã voucher".
- Dữ liệu phải dùng tên thật giả lập, không có "ZZE2E" (mục 5).

### Người xem: Nhân viên hậu kiểm

**NV-1. Hậu kiểm một hồ sơ** (nhân viên quản hai ngân hàng; dữ liệu giống V5)
1. Đăng nhập, mở Hồ sơ học sinh, lọc Chờ kiểm tra (HS-01, HS-08).
2. Đọc cột Ngân hàng: tag "Chờ" và Xác thực ảnh x/y của từng ngân hàng (HS-20, HS-22).
3. Tìm theo họ tên, mở hồ sơ (HS-03).
4. Đọc thẻ Thông tin và Hồ sơ trùng (CT-01, CT-05).
5. Xem ảnh từng khung, bấm ảnh mở tab mới (CT-09, XA-01).
6. Đọc khối Xác thực ảnh: khung Đạt, khung Không đạt và lý do (KA-04, KA-05).
7. Đánh dấu Đạt ngân hàng 1: voucher hiện ở khối SMS, nút Sửa thông tin biến mất, dòng "đánh dấu lúc" hiện ra (HK-01, CT-14, SU-07, CT-13, HK-06).
8. Đánh dấu Không đạt ngân hàng 2 (HK-02).
9. Đổi Không đạt sang Đạt, voucher giữ nguyên (HK-03, HK-04).
10. Bấm quay lại về danh sách: hồ sơ hết ở lọc Chờ kiểm tra, cột Người kiểm có tên (CT-20, HK-05, HS-24).
- V5 đã phủ bước 3, 5 (chưa mở tab), 7 (chỉ phần voucher), 8, 9.
- **Thiếu video**: bước 1, 2, 4, 6, phần còn lại của bước 7, bước 10. Bước 6 cần V5 chờ kiểm ảnh xong trước khi quay.

**NV-2. Sửa hồ sơ trước khi đánh dấu**
1. Mở hồ sơ Chờ kiểm tra.
2. Bấm Sửa thông tin, sửa lớp và SĐT phụ huynh, Lưu (SU-01).
3. Thêm ghi chú nội bộ, rồi sửa ghi chú (GC-01).
4. Tải ảnh thay thế cho một khung: khung ghi "Ảnh thay thế của", Xác thực ảnh về Đang kiểm (TA-01, CT-12, TA-02).
5. Tải lại trang sau khi kiểm xong: Xác thực ảnh có kết quả mới (KA-04).
- **Thiếu video**: cả video. Chưa có flow nào quay Sửa thông tin, Ghi chú, Tải ảnh thay thế.

**NV-3. Trang Ngân hàng của nhân viên** (nhân viên quản một ngân hàng)
1. Đăng nhập, mở Ngân hàng nhóm Nghiệp vụ: chỉ có dòng ngân hàng mình quản, không có mục lọc Ngân hàng (NH-15).
2. Đọc cột Xác thực ảnh và màu xanh, cam, đỏ (NH-09).
3. Bấm tên ngân hàng mở hồ sơ (NH-17).
4. Thẻ ngân hàng không quản chỉ có tên và trạng thái, không có ảnh và nút (CT-11).
- V10 "Nhân viên quản VPBank chỉ thấy dòng VPBank, không có mục lọc Ngân hàng" đã phủ bước 1.
- **Thiếu video**: bước 2, 4. Bước 3 mới có ở vai Quản trị (V10).

**NV-4. Tin SMS lỗi và Gửi lại**
1. Thấy badge số tin lỗi ở menu Tin SMS lỗi (SL-01).
2. Mở trang: đọc SĐT nhận, câu lỗi, Lần gửi 3/3 (SL-03).
3. Bấm Gửi lại, sửa SĐT nhận, Lưu (SL-05).
4. Tải lại sau khi gửi xong, bỏ chip Lỗi, chọn Đã gửi: tin tới số mới đã gửi (SL-04, SL-06).
- V6 "Tin SMS lỗi: sidebar đếm tin lỗi, bảng ghi lỗi và 3/3 lần gửi", "Sửa SĐT nhận, bấm Gửi lại", "Worker gửi lại tới số mới: tin sang Đã gửi" phủ bước 1 tới 4 ở vai Quản trị.
- **Thiếu video**: bản vai Nhân viên, không có bước worker và note log. Bước 4 chưa quay phần đổi chip.

**NV-5. Khi hộp báo có người vừa làm** (ngắn)
1. Mở hồ sơ, người khác đánh dấu trước (dựng qua API ngoài khung quay), bấm Đạt: hộp báo "Ngân hàng này đã có người đánh dấu. Tải lại trang để xem kết quả mới." (HK-10).
2. Tải lại trang, thấy kết quả mới.
3. Người khác tải ảnh thay thế trước, bấm Đạt: hộp báo "Ảnh vừa được thay. Tải lại trang để xem ảnh mới." (HK-11).
4. Tải lại trang, xem ảnh mới rồi Đạt.
- **Thiếu video**: cả video. ebd-10, ebd-11 đã có e2e.

### Người xem: Quản lý

**QL-1. Theo dõi hồ sơ học sinh**
1. Đăng nhập Quản lý, mở Hồ sơ học sinh: thấy hồ sơ mọi ngân hàng (HS-30).
2. Lọc Đã kiểm tra và Số ngân hàng đạt 1 (HS-09, HS-11).
3. Lọc Xác thực ảnh Thiếu (HS-13).
4. Lọc theo ngày (HS-15).
5. Bỏ từng chip lọc (HS-17).
6. Tìm theo SĐT phụ huynh (HS-04).
7. Mở một hồ sơ Chờ kiểm tra, đánh dấu Đạt thay nhân viên (HK-24).
- V7 "Trang 3 lọc theo kết quả xác thực ảnh" phủ bước 3 ở vai Quản trị.
- **Thiếu video**: mọi bước ở vai Quản lý.

**QL-2. Trang Ngân hàng**
1. Mở Ngân hàng nhóm Nghiệp vụ: mỗi ngân hàng học sinh chọn ra một dòng, thấy mọi ngân hàng (NH-01, NH-20).
2. Lọc theo trường (NH-02).
3. Lọc hai ngân hàng (NH-05).
4. Lọc trạng thái Không đạt (NH-07).
5. Lọc Xác thực ảnh Thiếu (NH-08).
6. Tìm theo tên (NH-10).
7. Đổi chiều cột Ngày (NH-11).
- V10 phủ bước 1, 2, 3 (một ngân hàng), 6 ở vai Quản trị.
- **Thiếu video**: bước 4, 5, 7 và vai Quản lý.

**QL-3. Mã voucher**
1. Mở Mã voucher (VC-01).
2. Tìm theo mã, rồi theo họ tên (VC-02).
3. Lọc ngày cấp (VC-03).
4. Bấm tên học sinh mở hồ sơ (VC-08).
- V5 "Voucher hiện ở Trang 12 Mã voucher" và V9 "Trang 12 Mã voucher: 2 mã" chỉ mở trang.
- **Thiếu video**: bước 2, 3, 4.

**QL-4. Xuất Excel**
1. Hồ sơ học sinh: lọc rồi bấm Xuất Excel (XE-01).
2. Ngân hàng: bấm Xuất Excel (XE-02).
3. Mã voucher: bấm Xuất Excel (XE-03).
- V9 phủ bước 1 tới 3 ở vai Quản trị. Kết quả chỉ hiện qua note kỹ thuật.
- **Thiếu video**: bản không có note kỹ thuật. Video phải cho thấy file đã tải về, không đọc tầng đầu bảng bằng note.

### Người xem: Quản trị

Quản trị xem mọi video của Quản lý. Thêm một video riêng:

**QT-1. Vận hành hệ thống**
1. Mở Hệ thống, Vận hành hệ thống (VH-01).
2. Đọc 4 ô máy chủ, ô có tag "Vượt 80%" (VH-04).
3. Đọc số lượt kiểm ảnh đang đợi và lượt đợi lâu nhất (VH-05).
4. Đọc bảng 7 ngày theo ngân hàng, cột Lỗi kiểm (VH-06).
- V8 "Xem Trang 18 Vận hành hệ thống" phủ bước 1, 3, chạy với S3 tắt, bảng không có số thật.
- **Thiếu video**: bước 2, 4. Bước 2 cần dựng số đo quá 80%.

### Người xem: Học sinh

Không có video học sinh trong phạm vi file này. Bước V5 "Học sinh mở lại web: chỉ thấy QR và nút Mở app PVI, không có chữ voucher" thuộc file rà web học sinh.

### Ca chỉ cần e2e

Mọi ca có cột Đề xuất là "E2E" ở mục 2: 148 ca. Đó là ca biên, URL lạ, chữ dài, phân quyền bằng URL, hai tab, mạng chậm, mất mạng, nhánh worker, giới hạn 20.000 dòng, audit.

Ca **thiếu e2e** cần viết trước (ưu tiên vì người dùng thấy trên màn):
- HS-24 cột Người kiểm, CT-13 dòng "đánh dấu lúc", CT-20 nút quay lại: nằm trong NV-1.
- HS-30, NH-20, HK-24: vai Quản lý chưa có test nào trên trang nghiệp vụ.
- NH-08, NH-09: lọc và cột Xác thực ảnh ở trang Ngân hàng.
- VH-04, VH-06: số liệu thật ở Vận hành hệ thống.
- TA-02, SU-09: Xác thực ảnh về Đang kiểm sau khi thay ảnh hay đổi họ tên.
- VC-08: Quản trị, Quản lý bấm tên ở Mã voucher.

## 5. Chữ "ZZE2E", "ZZDEMO", "E2E ", `zz_e2e_*` sẽ hiện trong video thuộc phạm vi

| Chữ hiện ra | Video và chỗ hiện | Nguồn |
|---|---|---|
| Tên ngân hàng "ZZE2E HS VPBank", "ZZE2E HS TPBank", "ZZE2E HS MB" | V5 thẻ ngân hàng ở Trang 4 và danh sách ngân hàng trên web học sinh; V6, V7, V9 cột Ngân hàng; V10 cột Ngân hàng, ô chọn lọc, chip "Ngân hàng: ZZE2E HS TPBank"; V8 bảng Kiểm ảnh theo ngân hàng (V7 chạy trước) | `scripts/e2e-seed.ts` (`${E2E_NAME}HS ${key}`); hằng tên trong spec 05, 06, 07, 09, 10; `scripts/e2e-data.ts` |
| Tên trường "ZZE2E THPT Học sinh" | Cột Trường ở Hồ sơ học sinh, Mã voucher, Tin SMS lỗi; thẻ Thông tin Trang 4; ô tìm và chip Trường ở V10; đầu web học sinh ở V5 | `scripts/e2e-data.ts`, `scripts/e2e-seed.ts` |
| Mã voucher "ZZE2ETHPTHS-..." | V5 khối SMS và Mã voucher; V6 khối SMS, note log; V9 Mã voucher | `src/server/voucher.ts` viết tắt tên trường; từ viết hoa toàn bộ "ZZE2E" giữ nguyên. Regex trong `e2e/flows/05-hau-kiem.spec.ts` và `e2e/review.spec.ts` phụ thuộc mã này |
| Note log SMS có "ZZE2E THPT Hoc sinh", "ZZE2E HS VPBank" và mã voucher | V6 "Worker SMS chạy một vòng: gửi tin, ghi log" | `src/server/sms/send.ts` ghi log; `e2e/flows/06-sms.spec.ts` gọi `note()` |
| Username `zz_e2e_admin`, `zz_e2e_kiem`, `zz_e2e_reviewer` | Ô "Tài khoản" ở màn đăng nhập và overlay thao tác của mọi video V5 tới V10 | `e2e/flows/support.ts` (`login`), `scripts/e2e-seed.ts` |
| Họ tên "E2E Quản trị", "E2E Kiểm hai ngân hàng", "E2E Hậu kiểm" | Sidebar mọi video; meta "Người quản ..." ở thẻ ngân hàng; dòng "... đánh dấu lúc"; cột Người kiểm ở V9; khung chương V5 "E2E Kiểm hai ngân hàng quản VPBank và TPBank" | `scripts/e2e-seed.ts`; `chapter()` trong `e2e/flows/05-hau-kiem.spec.ts` |
| Người liên hệ trường "E2E" | V9 bước "Trang 5 Trường: các trường e2e" (thuộc nhóm Cấu hình) | `scripts/e2e-data.ts` (`contactName`) |
| Chữ "ZZE2E" gõ vào ô tìm Trường, danh sách trường ZZE2E; tên bước "các trường e2e" | V9 "Trang 5 Trường: các trường e2e" | `e2e/flows/09-xuat-excel.spec.ts` |
| Dữ liệu ca biên: ngân hàng "ZZE2E Biên Ngân hàng Thương mại...", "ZZE2E Biên Ngân hàng Hai", "ZZE2E Biên Ngân hàng Trống"; trường "ZZE2E THPT Biên Nghiệp Vụ ...", "ZZE2E THPT Biên Hai"; học sinh "Biên <script>alert(1)</script>", "=1+2 Biên Công Thức", "Biên Phân Trang 01" tới "16"; voucher "ZZBIEN-..."; người dùng "E2E Biên Một" tới "E2E Biên Bốn" | Mọi bước mở trang chưa lọc: V6 Tin SMS lỗi (16 tin "Biên Phân Trang", badge đếm cả các tin này), V7, V9 Hồ sơ học sinh và Mã voucher, V10 bước "Quản trị mở trang Ngân hàng trong nhóm Nghiệp vụ" | `bun run e2e:flows` chạy `scripts/e2e-seed.ts`, seed này gọi `seedBusiness` ở `scripts/e2e-seed-business.ts`, dữ liệu ở `scripts/e2e-data-business.ts` |
| Trường "ZZDEMO", ngân hàng "ZZVPB" và 3 hồ sơ thật của DB local | Danh sách chưa lọc và bảng Kiểm ảnh ở Vận hành hệ thống, nếu máy quay dùng DB local | DB local (ghi ở `docs/plans/2026-11-05-e2e-video.md`), không do seed e2e tạo |
| Locator tiếng Anh có tên dữ liệu, ví dụ `getByRole('region', { name: 'ZZE2E HS VPBank' })` | Góc phải dưới mọi video | `playwright.config.ts` bật `video.show`, overlay thao tác không tắt riêng được |
| Tên file và tên test như "05-hau-kiem.spec.ts", "Flow 5: ..." | Góc trái trên mọi video | `e2e/flows/video.ts` (`flowVideo`) |
| Note kỹ thuật: khoá S3 của ảnh, log worker kiểm ảnh | V7 "Ảnh học sinh nộp lưu ở dạng WebP, chưa kiểm", "Worker kiểm ảnh chạy một vòng" | `e2e/flows/07-kiem-anh.spec.ts` gọi `note()` |
| Note tên file Excel và "Tầng 1 (nhóm)", "Tầng 2 (tổng)" | V9 mọi bước xuất | `e2e/flows/09-xuat-excel.spec.ts` gọi `note()` |
