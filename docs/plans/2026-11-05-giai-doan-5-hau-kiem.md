# Giai đoạn 5: Hậu kiểm, voucher, SMS

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** người quản ngân hàng xem hồ sơ, xem ảnh, đánh dấu Đạt hoặc Không đạt. Đạt đầu tiên của học sinh sinh mã voucher và xếp SMS. Có trang Mã voucher, trang Tin SMS lỗi, Xuất Excel.

**Thiết kế gốc:** Trang 3, 4, 12, 16 và mục `id="hau-kiem"`, `id="du-lieu"` (luật "Hậu kiểm bấm Đạt hoặc Không đạt", "Đổi kết quả", "Sinh mã voucher", "Worker SMS", "Xem ảnh", "Sửa thông tin và thay ảnh") trong `../Mở tài khoản học sinh qua QR trường.html`.

## Quyết định đã chốt

- Phạm vi: Quản trị, Quản lý thấy hồ sơ toàn công ty. Nhân viên thấy hồ sơ có chọn ngân hàng mình quản (`customerScope`). Ngoài phạm vi trả 404.
- Trang 3 Hồ sơ học sinh: cột Gửi lúc, Họ tên, Lớp, Trường, SĐT phụ huynh, Ngân hàng 1, Ngân hàng 2, Người kiểm. Ô ngân hàng có nhãn trạng thái; ngân hàng người xem quản thì thêm dòng "Xác thực ảnh x/y" (lượt `photo_checks` mới nhất, có ở giai đoạn 6). Phân trang, tìm, lọc ở máy chủ. Tìm theo họ tên không phân biệt dấu (`name_search` + trigram) hoặc SĐT. Bộ lọc: trạng thái, ngày gửi, số ngân hàng đạt (1 hoặc 2), kết quả xác thực ảnh. Vẽ bảng Bộ lọc theo mẫu mgst-app.
- Trang 4 Chi tiết hồ sơ, xếp trên dưới: khối Thông tin (Họ tên, Lớp, Trường, SĐT, Phụ huynh, SĐT phụ huynh có link gọi, Đã có TK, Hồ sơ trùng cùng tên và SĐT, Gửi lúc, Mở web lần cuối) có nút Sửa thông tin. Mỗi ngân hàng một khối. Ngân hàng người xem quản: ảnh từng khung (presigned 10 phút, mỗi lần xem ghi `audit_log` `view_photo`), khối Xác thực ảnh, Ghi chú nội bộ, nút Đạt, Không đạt, Tải ảnh thay thế. Ngân hàng khác của hồ sơ: chỉ dòng tiêu đề và trạng thái, không hiện ảnh. Khối SMS cho phụ huynh.
- Đánh dấu: một transaction khoá dòng `customers`, cập nhật `customer_banks` với điều kiện trạng thái đúng (không có dòng nào đổi thì báo "đã có người đánh dấu"), ghi `review_events`. Đạt đầu tiên (`first_passed_at` rỗng): ghi thời điểm, sinh voucher, thêm `sms_messages` `queued`. Hết ngân hàng `pending` thì học sinh sang `reviewed`.
- Dòng Đạt bị khoá: không đổi kết quả, không thay ảnh. Hồ sơ đã có voucher thì không sửa thông tin. Dòng Không đạt đổi được sang Đạt; nếu học sinh chưa có voucher thì lượt đổi này sinh voucher và gửi SMS như lượt đầu, đã có thì không gửi thêm. Không theo dõi "đã gọi".
- Thay ảnh: ghi `replaced_at` cho ảnh cũ, thêm dòng mới có `uploaded_by`. Thay ảnh hoặc sửa họ tên thì xếp lại lượt `photo_checks` cho ngân hàng liên quan (xoá dòng pending cũ, thêm dòng mới, `pg_notify`).
- Mã voucher: `viết tắt trường-viết tắt học sinh-lớp-4 ký tự kiểm`, ví dụ `THPTND-TMA-11A3-K7Q2`. Viết tắt: bỏ dấu, viết hoa, chữ cái đầu mỗi từ; từ viết hoa toàn bộ như THPT, THCS giữ nguyên. Lớp viết hoa bỏ khoảng trắng. Ký tự kiểm: HMAC-SHA256 (khoá `VOUCHER_SECRET` trong env) của id học sinh, mã tỉnh, mã xã của trường, họ tên phụ huynh và 3 phần chữ; lấy 4 ký tự từ bảng chữ số không có 0, O, 1, I, L. Mã đã cấp không đổi khi sửa tên.
- SMS: nội dung theo `settings.sms_template`, thay `{HO_TEN}` (viết hoa bỏ dấu), `{LOP}`, `{TRUONG}` (bỏ dấu), `{NGAN_HANG}` (ngân hàng đạt đầu tiên), `{MA_VOUCHER}`. Gửi tới SĐT phụ huynh. Một học sinh một tin (`unique (customer_id, kind)`). Quá 160 ký tự thì gửi 2 tin.
- Module gửi SMS `src/server/sms/send.ts` có một hàm gửi dùng chung. Bản đầu chưa nối nhà cung cấp: hàm ghi số nhận và nội dung ra log. Worker `scripts/sms-worker.ts` lấy tin `queued` bằng `for update skip locked`, nghe `LISTEN` và quét lại mỗi 30 giây. Gửi lỗi thì thử lại, tối đa 3 lần, rồi đánh dấu `failed`.
- Trang 16 Tin SMS lỗi: tin `failed` trong phạm vi người xem, sửa SĐT, nút Gửi lại (đặt lại `attempts = 0`, trạng thái `queued`). Mục "Tin SMS lỗi" trên sidebar hiện số tin lỗi trong phạm vi người xem.
- Trang 12 Mã voucher (quyền `vouchers`): Mã voucher, Họ tên, Lớp, Trường, Phụ huynh, Ngày cấp. Tìm theo mã, họ tên.
- Xuất Excel (quyền `export_excel`): chép `src/lib/excel.ts` của mgst-app (đầu bảng 3 tầng, chuẩn mục 12 trong `../mgst-app/AGENTS.md`). File xuất đúng bộ lọc đang xem và đúng phạm vi người xuất. Có ở Trang 3 (hồ sơ), Trang 5 (trường), Trang 12 (voucher). Mỗi lần xuất ghi `audit_log`.
- Route ảnh quản lý: ảnh thư mục `proofs` chỉ người quản ngân hàng của dòng ảnh đó, Quản trị, Quản lý xem được.

## Việc để lại từ giai đoạn trước thuộc giai đoạn này

- `sms_messages.kind` text tự do; nút Gửi lại phải đặt lại `attempts`.
- Tìm kiếm phân biệt dấu ở Trường, Kho mã, ô chọn người quản; chưa thoát `%` `_`. Sửa luôn cho các ô tìm cũ.
- Mẫu SMS nhận biến không có thật như `{HOTEN}`: Cài đặt phải từ chối biến lạ.
- Chưa có test DB cho khoá đăng nhập khi nhiều request cùng lúc, chưa có test API Nhân viên nhận 403.

## Task

- [x] **Task 1: Danh sách hồ sơ.** Nghiệp vụ, route, Trang 3, Bộ lọc. Test DB: phạm vi, lọc, tìm không dấu, phân trang.
- [x] **Task 2: Chi tiết hồ sơ, xem ảnh, sửa thông tin.** Trang 4. Test DB: Nhân viên không xem được ảnh ngân hàng khác, mỗi lần xem ảnh ghi audit, hồ sơ có voucher không sửa được.
- [x] **Task 3: Đánh dấu, đổi kết quả, thay ảnh.** Test DB: hai người cùng đánh dấu một dòng thì người sau nhận lỗi và chỉ một voucher, một SMS (chạy song song); Đạt khoá; Không đạt sang Đạt sinh voucher khi chưa có; thay ảnh xếp lại `photo_checks`.
- [x] **Task 4: Mã voucher.** Hàm sinh mã thuần, test unit với ví dụ thiết kế (viết tắt, lớp, bảng chữ ký tự kiểm, cùng dữ liệu cùng mã). Trang 12.
- [x] **Task 5: SMS.** Module gửi, worker, Trang 16, số đếm trên sidebar. Test DB: worker gửi tin `queued`, lỗi 3 lần thì `failed`, Gửi lại đặt lại `attempts`.
- [x] **Task 6: Xuất Excel và việc để lại.** Chép `excel.ts`, ba route export, tìm không dấu cho các ô tìm cũ, chặn biến lạ trong mẫu SMS, hai test còn thiếu.
- [x] **Task 7: E2E.** Học sinh nộp ảnh (dựng bằng API hoặc chạy lại luồng giai đoạn 4), người quản đánh dấu Đạt, thấy voucher trên Trang 4 và Trang 12, học sinh thấy voucher ở màn kết quả; Nhân viên không thấy ảnh ngân hàng khác.

Cuối giai đoạn chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.

## Kết quả

Agent làm xong 7 task ngày 2026-11-05, commit 858dd70 tới commit ghi mục này, trên nhánh `dev`.

### Đã làm

- Trang 3 Hồ sơ học sinh (`/customers`): phạm vi theo `customerScope`, 15 dòng một trang, tìm họ tên không dấu (`name_search`) hoặc SĐT, Bộ lọc kiểu mgst-app (Trạng thái, Ngày gửi, Số ngân hàng đạt, Xác thực ảnh) ghi lên URL, chip bỏ lọc. Ô ngân hàng có nhãn trạng thái và dòng "Xác thực ảnh x/y" ở ngân hàng người xem quản. Route `GET /api/admin/customers`.
- Trang 4 Chi tiết hồ sơ (`/customers/:id`): khối Thông tin (SĐT phụ huynh có link gọi, Đã có TK, Hồ sơ trùng cùng tên và SĐT, Gửi lúc, Mở web lần cuối), nút Sửa thông tin khi chưa có voucher. Mỗi ngân hàng một khối. Ngân hàng người xem quản có ảnh từng khung, Xác thực ảnh, Ghi chú nội bộ (sửa bằng nút bút chì), nút Đạt, Không đạt, Tải ảnh thay thế. Ngân hàng khác chỉ có tiêu đề và trạng thái. Khối SMS cho phụ huynh có mã voucher.
- Xem ảnh qua `GET /api/admin/photos/:id`: kiểm quyền theo ngân hàng của dòng ảnh, ghi `audit_log` `view_photo`, chuyển sang link S3 hạn 10 phút.
- Đánh dấu (`POST /api/admin/customer-banks/:id/review`): một transaction khoá dòng `customers`, cập nhật `customer_banks` theo trạng thái người kiểm thấy, ghi `review_events`. Đạt đầu tiên ghi `first_passed_at`, sinh voucher, thêm `sms_messages` `queued` và `pg_notify('sms_messages')`. Hết dòng pending thì hồ sơ sang `reviewed`. Dòng Đạt bị khoá. Không đạt đổi được sang Đạt và cấp voucher nếu chưa có.
- Thay ảnh (`POST /api/admin/customer-banks/:id/photos`): ảnh qua máy chủ, ảnh cũ ghi `replaced_at`, ảnh mới có `uploaded_by`, xếp lại `photo_checks`. Sửa họ tên cũng xếp lại `photo_checks`. Ghi chú: `PUT /api/admin/customer-banks/:id/note`.
- Mã voucher (`src/server/voucher.ts`): viết tắt trường, học sinh, lớp và 4 ký tự kiểm HMAC-SHA256 bằng `VOUCHER_SECRET`. Thiếu khoá thì máy chủ từ chối lượt Đạt cần cấp voucher. Trang 12 Mã voucher (`/vouchers`) tìm theo mã hoặc họ tên, lọc Ngày cấp.
- SMS: `src/server/sms/send.ts` ghi số nhận và nội dung ra log. `src/server/sms/queue.ts` gửi từng tin trong transaction `for update skip locked`, lỗi thì giữ `queued`, lỗi lần thứ 3 thì `failed`. Worker `scripts/sms-worker.ts` (`bun sms:worker`) nghe `LISTEN sms_messages` và quét lại mỗi 30 giây. Trang 16 Tin SMS lỗi (`/sms`) mở sẵn lọc Lỗi, nút Gửi lại mở hộp thoại sửa SĐT nhận, đặt lại `attempts = 0`. Mục Tin SMS lỗi trên sidebar hiện số tin lỗi trong phạm vi người xem.
- Xuất Excel: `src/lib/excel.ts` chép từ mgst-app (đầu bảng 3 tầng), dựng file ở máy chủ. Ba route `GET /api/admin/{customers,schools,vouchers}/export` xuất đúng bộ lọc và phạm vi, ghi `audit_log` `export_excel`, trần 20.000 dòng.
- Migration 0003: check `sms_messages.kind in ('voucher')` và extension `unaccent`.
- Việc để lại thuộc giai đoạn này: Gửi lại đặt lại `attempts`; ô tìm Trường, ô chọn trường, Kho mã, ô chọn người quản, Tài khoản không phân biệt dấu và thoát `%` `_`; Cài đặt từ chối biến lạ trong mẫu SMS; test DB khoá đăng nhập khi nhiều request cùng lúc; test route Nhân viên nhận 403.
- `VOUCHER_SECRET` nằm trong `.env.local` (giá trị ngẫu nhiên) và `.env.example` (rỗng).

### Test

- `bun run test`: 113 pass. `bun test:db`: 160 pass. `bun test:s3`: 6 pass. `bun run e2e`: 14 pass. `bunx tsc --noEmit`: sạch. `bun run lint`: 0 lỗi, 2 cảnh báo `<img>` có từ giai đoạn 3.
- Test chạy song song thật bằng `Promise.all` trên các kết nối riêng của pool: hai người cùng đánh dấu một dòng (một lịch sử, một voucher, một SMS); hai người bấm Đạt hai ngân hàng của một học sinh, lặp 5 lần (một voucher, một SMS); hai worker cùng lấy một tin (một lần gửi); 10 request sai mật khẩu cùng lúc (đúng 4 lần báo sai).
- Kiểm đột biến: bỏ khoá dòng `customers` thì test hai ngân hàng fail; đổi phép cộng nguyên tử của đăng nhập thì test đăng nhập song song fail; cho Nhân viên thấy ảnh mọi ngân hàng thì e2e fail. Agent trả code về sau mỗi lần.

### Ruling

- "Người quản ngân hàng" của hậu kiểm theo `customerScope`: Quản trị, Quản lý mọi ngân hàng; Nhân viên chỉ ngân hàng được giao. Quyền Quản lý ngân hàng không mở hồ sơ. Hàm `reviewsBank` ở `src/lib/permissions.ts`.
- Quản trị, Quản lý đánh dấu được mọi ngân hàng, dù thiết kế ghi "chỉ người quản ngân hàng đó".
- Hàm sinh mã voucher làm ở đầu Task 3 vì Task 3 cần mã; Task 4 còn Trang 12.
- Danh sách xếp hồ sơ Chờ kiểm tra lên đầu, gửi trước xếp trước; hồ sơ khác mới nhất trước.
- Bộ lọc Trạng thái là trạng thái hồ sơ, nhãn theo sơ đồ trạng thái (Mới, Đã chọn ngân hàng, Chờ kiểm tra, Đã kiểm tra, Không có ngân hàng). Số ngân hàng đạt đếm mọi dòng passed của hồ sơ. Xác thực ảnh xét lượt mới nhất đã xong của ngân hàng trong phạm vi người xem: Đủ khung đạt hoặc Có khung không đạt.
- Ô Ngày gửi, Ngày cấp dùng hai ô `input type=date`. Mặc định không lọc gì, trừ trang SMS mở sẵn Lỗi.
- Trang chủ sau đăng nhập không đổi sang `/customers` (e2e cũ dựa vào `/users`).
- Ảnh học sinh xem qua route mới `/api/admin/photos/:id`. Mỗi lần trình duyệt tải ảnh là một dòng audit `view_photo`.
- Khối SMS bỏ câu "Hệ thống gửi ngay khi ngân hàng đầu tiên được đánh dấu Đạt." vì AGENTS cấm câu giải thích.
- Sửa thông tin gồm Họ tên, Lớp, SĐT, Phụ huynh, SĐT phụ huynh; không đổi trường và ngân hàng đã có. Sửa họ tên xếp lại `photo_checks` cho dòng pending hoặc failed có khung kiểm họ tên.
- `photo_checks.result` là mảng `{ slotId, slotName, expected, passed, reason }` (`src/lib/photoCheck.ts`). Giai đoạn 6 phải ghi đúng dạng này.
- `queuePhotoChecks` dùng chung cho Gửi kiểm tra, thay ảnh và sửa họ tên.
- Request đánh dấu gửi kèm trạng thái người kiểm thấy (`expected`). Trạng thái đã khác thì báo "đã có người đánh dấu", để người thứ hai không âm thầm đè lên kết quả vừa ghi.
- Thiếu `VOUCHER_SECRET` thì từ chối cả lượt Đạt cần cấp voucher (lỗi 500), không ghi Đạt mà thiếu voucher. Đạt khi đã có voucher và Không đạt vẫn ghi được.
- `{HO_TEN}` viết hoa bỏ dấu; `{TRUONG}`, `{NGAN_HANG}` bỏ dấu, giữ hoa thường; `{NGAN_HANG}` là ngân hàng của lượt Đạt cấp voucher.
- Tải ảnh thay thế qua `POST /api/admin/customer-banks/:id/photos` thay vì `/api/admin/photos/:id/replace` của thiết kế, vì khung có thể chưa có ảnh. Chỉ thay ảnh khung đang dùng của dòng pending hoặc failed. Thay ảnh không đổi trạng thái dòng.
- Ghi chú nội bộ sửa riêng bằng nút bút chì, mọi trạng thái dòng. Nút Đạt, Không đạt chỉ hỏi một câu xác nhận.
- Va chạm mã voucher (trùng 3 phần chữ và trùng 4 ký tự kiểm, xác suất 1/923.521) để unique của `vouchers.code` báo lỗi, không thử lại.
- Viết tắt giữ cả từ khi từ viết hoa toàn bộ (THPT, ZZE2E); từ khác lấy chữ đầu sau khi bỏ dấu; chỉ giữ A-Z, 0-9. Lớp bỏ mọi ký tự khác chữ và số.
- 4 ký tự kiểm lấy 8 byte đầu của HMAC-SHA256 đổi sang hệ 31. Thông điệp HMAC là id học sinh, mã tỉnh, mã xã, tên phụ huynh và 3 phần chữ, nối bằng xuống dòng.
- Trang 12 hiện mọi voucher cho người có quyền `vouchers`, không giới hạn theo ngân hàng. Tên học sinh chỉ thành link khi người xem thấy mọi hồ sơ.
- Worker gửi mỗi tin một lần mỗi vòng, tin lỗi chờ vòng sau, không giãn cách. Mất kết nối LISTEN thì worker thoát để trình quản lý tiến trình chạy lại.
- Gửi lại đổi `sms_messages.to_phone`, không đổi SĐT phụ huynh của hồ sơ. Audit `resend_sms` ghi SĐT trước và sau.
- Migration 0003 thêm check loại tin SMS và `CREATE EXTENSION unaccent` (chép tay vào file sinh ra như `pg_trgm` ở 0000).
- File Excel dựng ở máy chủ, nút Xuất Excel tải bằng fetch để báo lỗi cạnh nút. `excel.ts` bỏ phần tải trên trình duyệt và hộp chọn cột của mgst-app.
- Trần 20.000 dòng một file Excel.
- Cột xuất: hồ sơ có khối HỌC SINH, NGÂN HÀNG 1, NGÂN HÀNG 2, VOUCHER; trường có khối TRƯỜNG (kèm link QR) và HỒ SƠ HỌC SINH; voucher có khối VOUCHER và HỌC SINH, không có SĐT vì Trang 12 không hiện SĐT. Xuất trường cần thêm quyền `schools`, xuất voucher cần thêm quyền `vouchers`.
- Ô tìm cũ so bằng `unaccent(lower(cột)) LIKE` từ khoá đã bỏ dấu, không thêm cột bỏ dấu lưu sẵn.
- Sửa luôn việc làm tròn số trang của `listUsers` (việc để lại giai đoạn 2) vì đang sửa cùng hàm.
- Mẫu SMS chỉ nhận 5 biến có thật; biến lạ và ngoặc lẻ bị từ chối.
- E2E chạy lại luồng học sinh trên giao diện. Seed thêm `zz_e2e_reviewer` quản ZZE2E HS VPBank và có quyền `vouchers`.
- Ô lọc dùng `useOptimistic` để đổi ngay khi bấm. `Card` có `aria-label` bằng tiêu đề.

### Việc để lại

| Việc | Khi nào |
|---|---|
| Production phải đặt `VOUCHER_SECRET` và không đổi sau khi cấp mã đầu tiên | Giai đoạn 7 |
| Production chạy migration 0003 cần quyền `CREATE EXTENSION unaccent` | Giai đoạn 7 |
| Worker SMS chưa có container hoặc systemd; chưa nối nhà cung cấp SMS, `send.ts` chỉ ghi log | Giai đoạn 7 |
| Worker SMS thử lại không giãn cách; tin lỗi gửi lại ở vòng kế tiếp hoặc khi có thông báo khác | Khi nối nhà cung cấp |
| Giai đoạn 6 phải ghi `photo_checks.result` đúng dạng `src/lib/photoCheck.ts` | Giai đoạn 6 |
| Hai học sinh trùng 3 phần chữ và trùng 4 ký tự kiểm thì lượt Đạt của người sau lỗi mãi | Khi có ca thật |
| Mỗi lần mở Trang 4 ghi một dòng audit cho mỗi ảnh; bảng `audit_log` lớn nhanh | Giai đoạn 7 |
| `putImage` báo "Chỉ nhận ảnh jpg, png hoặc webp." cho ảnh thay thế dù nhận cả HEIC | Khi sửa storage |
| Ô tìm cũ dùng `unaccent` không có chỉ mục, quét cả bảng | Khi bảng lớn |
| Bộ lọc Xác thực ảnh chưa có giá trị "Chưa kiểm" | Khi user cần |
| Trang chủ sau đăng nhập vẫn là Tài khoản hoặc Cá nhân, chưa về Hồ sơ học sinh | Khi user cần |
| Đổi SĐT ở Gửi lại không đổi SĐT phụ huynh của hồ sơ | Khi user cần |

