# Giai đoạn 4: Web học sinh

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** học sinh quét QR của trường, khai thông tin, chọn ngân hàng, làm theo hướng dẫn, nộp ảnh, gửi kiểm tra, xem kết quả. Tất cả trên điện thoại, tên miền `bank.*`.

**Kiến trúc:** trang ở `src/app/student/**` (proxy rewrite từ tên miền học sinh). API ở `src/app/api/customers/**`, `src/app/api/schools/**`. Nghiệp vụ ở `src/server/customers.ts` (và file nhỏ cùng nhóm nếu cần). Học sinh không có tài khoản: máy chủ cấp token 32 byte lúc khai B1, DB lưu băm sha256 (`customers.token_hash`), điện thoại giữ token trong localStorage và gửi qua header `Authorization: Bearer <token>`.

**Thiết kế gốc:** các mục `id="b0"`, `b1`, `b2`, `b3`, `b4`, `trang-thai` và màn H0 tới H6b trong `../Mở tài khoản học sinh qua QR trường.html`. Chép câu chữ trên màn từ đó. Luật ghi dữ liệu ở mục `id="du-lieu"` phần "Luật ghi dữ liệu".

## Quyết định đã chốt

- Link QR là `/t/<id trường>`. Web lưu id trường vào localStorage rồi đổi URL về `/`. Id của trường khác với id đang lưu thì web hỏi (màn H1). Id sai thì web bỏ và dùng id đang lưu. Máy chưa có trường thì màn H0. Trường đã đóng thì web báo trường đã đóng.
- Không màn giới thiệu: quét QR xong vào thẳng B1.
- B1 có 5 ô bắt buộc: Họ và tên, Lớp, SĐT học sinh, Họ và tên phụ huynh, SĐT phụ huynh. Ô Lớp có placeholder `11A3`, máy chủ viết hoa và bỏ khoảng trắng. SĐT 10 số bắt đầu bằng 0, hai SĐT khác nhau. Không thu ngày sinh, không xét tuổi. Học sinh tick các ngân hàng đã có tài khoản (`customer_existing_banks`). Không OTP. `customers.name_search` = họ tên bỏ dấu, chữ thường (dùng `plain` trong `src/lib/text.ts`). `created_ip` từ `x-forwarded-for`.
- B2: máy chủ tính danh sách ngân hàng đủ điều kiện, không tin dữ liệu từ điện thoại: ngân hàng đang bật, không nằm trong danh sách đã có, có ít nhất một mã đang dùng gắn cho trường còn lượt trong tháng. Còn từ 2 trở lên thì phải chọn đúng 2. Chọn trước là vị trí 1, chọn sau là vị trí 2. Còn 1 thì web chọn sẵn. Còn 0 thì màn H3c, `customers.status = no_bank`.
- Bấm Tiếp tục ở B2 mới giữ chỗ. Một transaction: khoá các dòng mã ứng viên (`select ... for update`), với mỗi ngân hàng chọn mã có `priority` cao nhất còn lượt trong tháng. Tháng chưa có dòng `referral_code_months` thì tạo dòng, chép `monthly_quota`. Ghi `customer_banks` (`selected`, `slot`, `referral_code_id`, bản chép `referral_code`, `year_month`), học sinh sang `banks_selected`. Hết lượt giữa chừng thì trả lỗi để web tải lại danh sách. Không có hạn giữ chỗ, hệ thống không tự trả lượt.
- B3: mỗi ngân hàng một tab: các bước hướng dẫn (`banks.guide`), mã giới thiệu dạng chữ và ảnh QR, nút Sao chép, nút "Quét QR code" mở `referral_codes.open_url` ở tab mới (ẩn khi không có link), các khung ảnh (`bank_photo_slots` chưa bỏ, theo `sort_order`) có tên và ảnh mẫu.
- Nộp ảnh: điện thoại nén ảnh còn dưới 300 KB (canvas, cạnh dài tối đa 1600, xuất webp hoặc jpeg), xin presigned PUT cho một khung, tải thẳng lên S3, rồi báo máy chủ ghi `proof_photos`. Máy chủ kiểm object có thật và dung lượng (HeadObject). Trước khi gửi kiểm tra, chụp lại khung đó thì máy chủ xoá dòng và object cũ, ghi dòng mới. Thư mục ảnh học sinh là `proofs` (thêm vào `src/lib/imageKey.ts`, nhận cả heic).
  Nếu S3 FPT không nhận CORS cho PUT từ trình duyệt thì chuyển sang tải qua máy chủ như ảnh của trang quản lý, ghi ruling.
- Nút Quay lại ở B3: hỏi xác nhận nếu đã có ảnh. Một transaction xoá các dòng `customer_banks` trạng thái `selected` và ảnh của chúng; đọc `s3_key` trước khi xoá rồi xoá object S3. Học sinh về `new`, lượt trả về mã ngay.
- Nút Gửi kiểm tra bật khi mọi khung của mọi ngân hàng đã chọn đều có ảnh. Máy chủ kiểm lại. Một transaction: `customer_banks` sang `pending`, `submitted_at`; học sinh sang `pending_review`, `submitted_at`; mỗi ngân hàng có khung bật `check_name` hoặc `check_code` thì thêm một dòng `photo_checks` trạng thái `pending` (worker làm ở giai đoạn 6). Sau bước này API ảnh từ chối mọi request của học sinh đó.
- B4 (màn H5, H6, H6b): danh sách ngân hàng kèm trạng thái Chờ kiểm tra, Đạt, Không đạt. Không hiện lý do không đạt. Có voucher thì hiện mã voucher, nút Sao chép, QR tới link app PVI lấy từ `settings.pvi_app_url`. Có QR kết bạn Zalo từ `settings.zalo_url`. Mở web lần nào cũng ghi `customers.last_seen_at`.
- Ảnh mẫu và ảnh QR của mã: route ảnh của học sinh chỉ cấp presigned URL cho khoá thuộc ngân hàng học sinh đã chọn (ảnh mẫu, ảnh QR của mã được cấp) và ảnh của chính học sinh.
- Giao diện cho điện thoại trước, theo màn H0 tới H6b. Dùng token màu và component có sẵn.
- Giới hạn request theo IP làm ở Nginx (giai đoạn 7), không làm trong app.

## Việc để lại từ giai đoạn trước thuộc giai đoạn này

- Check `year_month` nhận `2026-13`: dùng `isYearMonth` khi ghi.
- Chưa ràng buộc `proof_photos.slot_id`, `customer_banks.referral_code_id` cùng ngân hàng với dòng `customer_banks`: code máy chủ phải kiểm.
- Quay lại từ B3: đọc `s3_key` trước khi xoá dòng vì cascade xoá dòng ảnh.
- Matcher của proxy bỏ qua mọi đường dẫn có đuôi ảnh: sửa để chỉ bỏ qua file có thật trong `public/`, đường dẫn `/admin/...x.png` và `/student/...` không đi vòng qua kiểm tên miền.
- Route ảnh của trang quản lý `/api/admin/images` đang mở cho mọi người đăng nhập: khoá thư mục `proofs` lại, để giai đoạn 5 kiểm quyền theo ngân hàng.

## Task

Mỗi task: viết test trước, xem fail, code, xem pass, commit.

- [x] **Task 1: Mở web và token.** `/t/[id]`, `/`, màn H0, H1, trường đã đóng. `GET /api/schools/:id`. Nghiệp vụ tạo token, đọc học sinh theo token, ghi `last_seen_at`. Test unit cho xử lý id trường trên máy (hàm thuần), test DB cho token.
- [x] **Task 2: B1 khai thông tin.** Form, `POST /api/customers`, danh sách ngân hàng để tick "đã có". Test DB: dữ liệu sai bị từ chối, lớp viết hoa bỏ khoảng trắng, `name_search`, `customer_existing_banks`.
- [x] **Task 3: B2 chọn ngân hàng và giữ chỗ.** Danh sách đủ điều kiện, `POST /api/customers/me/banks`. Test DB: chọn đúng 2 hoặc 1, ngân hàng đã có bị loại, mã hết lượt bị loại, chọn mã ưu tiên cao nhất, tạo dòng tháng, nhiều request giữ chỗ cùng lúc không vượt quota (chạy song song bằng `Promise.all` với pool riêng), giữ chỗ tháng 10 rồi đánh dấu tháng 11 vẫn tính tháng 10.
- [x] **Task 4: B3 hướng dẫn và nộp ảnh.** Tab ngân hàng, mã, QR, Sao chép, Quét QR code, khung ảnh, nén ảnh trên trình duyệt, presigned PUT (`scripts/s3-cors.ts` cài CORS cho bucket theo `STUDENT_ORIGIN`), ghi ảnh, chụp lại, Quay lại. Test DB cho ghi ảnh (khung của ngân hàng khác bị từ chối, chụp lại thay ảnh cũ) và Quay lại (trả lượt, xoá object). Test S3 cho presigned PUT.
- [x] **Task 5: Gửi kiểm tra và màn kết quả.** `POST /api/customers/me/submit`, màn H5, H6, H6b, voucher, QR PVI, QR Zalo. Test DB: thiếu ảnh bị từ chối, sau khi gửi không nộp ảnh được nữa, xếp `photo_checks`.
- [x] **Task 6: Việc để lại và e2e.** Sửa matcher của proxy và khoá `proofs` ở route ảnh quản lý. E2E trên khổ điện thoại (`devices["iPhone 13"]` hoặc viewport 390x844): quét link trường, khai, chọn 2 ngân hàng, nộp ảnh mọi khung, gửi, thấy màn chờ. E2E dựng dữ liệu bằng tiền tố `ZZE2E ` và dọn trong `scripts/e2e-clean.ts`.

Cuối giai đoạn chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.

## Kết quả

Agent làm xong 6 task ngày 2026-11-05, commit 156b08e tới commit ghi mục này, trên nhánh `dev`.

### Đã làm

- Mở web: `/t/<id>` và `/` dùng chung `StudentApp`. Web lưu id trường, token, id hồ sơ vào localStorage rồi cắt URL về `/`. Màn H0 có nút Quét mã QR mở camera trong hộp thoại (getUserMedia, zxing-wasm). Màn H1 hỏi đổi trường. Trường đã đóng thì web báo đóng.
- API học sinh: `GET /api/schools/:id`, `POST /api/customers`, `GET /api/customers/me`, `POST|DELETE /api/customers/me/banks`, `POST /api/customers/me/photos/upload-url`, `POST /api/customers/me/photos`, `POST /api/customers/me/submit`. Token 32 byte đi trong header `Authorization: Bearer`, DB giữ băm. Route ghi kiểm Origin của tên miền học sinh.
- B1: 5 ô bắt buộc, lỗi hiện dưới ô khi rời ô, tick ngân hàng đã có. Máy chủ viết hoa lớp, bỏ khoảng trắng, gọn họ tên, ghi `name_search`, `created_ip`. Hết ngân hàng thì hồ sơ là `no_bank`.
- B2: danh sách đủ điều kiện tính ở máy chủ. Giữ chỗ khoá các dòng mã bằng `select ... for update`, đếm lượt ở câu sau khi khoá, chọn mã priority cao nhất còn lượt, tạo dòng tháng, chép mã. Màn H3, H3b, H3c.
- B3: tab theo ngân hàng, các bước hướng dẫn, mã, ảnh QR, Sao chép, Quét QR code, khung ảnh có ảnh mẫu. Điện thoại nén ảnh dưới 300 KB (cạnh dài 1600, WebP hoặc JPEG), xin presigned PUT, tải thẳng lên S3, báo máy chủ ghi. Máy chủ đọc dung lượng bằng HeadObject. Chụp lại thay dòng và xoá object cũ. Quay lại hỏi xác nhận khi đã có ảnh, trả lượt, xoá object.
- Gửi kiểm tra: kiểm mọi khung chưa bỏ có ảnh, đổi trạng thái, xếp `photo_checks` cho ngân hàng có khung bật kiểm, gọi `pg_notify('photo_checks', id)`. Sau bước này API ảnh từ chối học sinh.
- B4: màn H5, H6, H6b, voucher, Sao chép mã voucher, QR app PVI, QR Zalo, SĐT phụ huynh đã che.
- `scripts/s3-cors.ts` cài CORS cho bucket theo `STUDENT_ORIGIN`. S3 FPT nhận CORS, presigned PUT từ trình duyệt chạy được.
- Việc để lại của giai đoạn 3: matcher của proxy chỉ bỏ qua file có thật trong `public`; route ảnh của trang quản lý không đọc thư mục `proofs`; route tải ảnh của trang quản lý chỉ nhận `samples`, `qr`; ghi `year_month` kiểm bằng `isYearMonth`; máy chủ kiểm khung ảnh và mã cùng ngân hàng với dòng `customer_banks`.

### Test

- `bun run test`: 77 pass. `bun test:db`: 88 pass. `bun test:s3`: 3 pass. `bun run e2e`: 11 pass. `bunx tsc --noEmit`: sạch. `bun run lint`: 0 lỗi, 2 cảnh báo `<img>` có từ giai đoạn 3.
- Test giữ chỗ song song fail khi bỏ `for update` (6/3 lượt), pass khi có khoá.
- E2E học sinh fail khi bỏ bước đổi trạng thái ở Gửi kiểm tra (kiểm đột biến).

### Ruling

- Thao tác của học sinh không ghi `audit_log`. Dấu vết nằm ở `created_ip`, `submitted_at`, `last_seen_at`.
- Web học sinh dùng tên thương hiệu Minh Group Intelligent thay chữ Minh Group ST trong ảnh thiết kế.
- Trường đã đóng chỉ chặn khai B1. Hồ sơ đã có ở trường đó vẫn đi tiếp B2 tới B4.
- Link của trường đã đóng vẫn tính là id hợp lệ khi quyết định đổi trường.
- H1 giữ hai câu của thiết kế, không ép thành một câu hỏi.
- Danh sách tick "đã có" ở B1 là các ngân hàng mở ở trường.
- Ô SĐT học sinh ghi nhãn "SĐT" như màn H2. Máy chủ bỏ dấu cách, dấu chấm trong SĐT.
- Ngân hàng đã có không tồn tại thì từ chối. Ngân hàng đã đóng vẫn nhận.
- Hồ sơ `new` hết ngân hàng thì sang `no_bank` cả lúc mở web lẫn lúc bấm Tiếp tục. Học sinh khai lúc mã hết lượt cuối tháng sẽ dừng hẳn.
- Các mã cùng priority thì chọn mã tạo trước.
- Bỏ câu "MB không hiện vì đã có tài khoản." ở H3 vì là câu giải thích.
- Không làm route nhận khoá ảnh của học sinh. `GET /api/customers/me` trả sẵn presigned GET hạn 1 giờ cho đúng ảnh mẫu, ảnh QR của mã đã cấp, ảnh của chính học sinh. Web tải lại hồ sơ mỗi lần học sinh quay lại tab.
- S3Client đặt `requestChecksumCalculation: "WHEN_REQUIRED"` để presigned PUT không mang checksum của body rỗng.
- Test DB của ảnh dùng kho ảnh giả trong bộ nhớ. Test S3 kiểm presigned PUT và HeadObject thật.
- Ảnh trình duyệt không mở được (HEIC trên Android) thì gửi file gốc, tối đa 10 MB.
- Báo lại cùng một khoá ảnh cho cùng khung thì trả ok, không ghi thêm dòng.
- Gửi kiểm tra gọi `pg_notify` trên kênh `photo_checks`.
- Giờ gửi SMS hiện đủ ngày và giờ.
- QR app PVI và QR Zalo bọc trong link mở bằng một chạm.
- Matcher của proxy liệt kê đích danh file trong `public`. Test unit đi qua mọi file trong `public`.
- E2E dùng viewport 390x844 trên Chromium, không dùng `devices["iPhone 13"]` vì device đó chạy WebKit.
- `e2e-seed` dựng trường id cố định với 3 ngân hàng. `e2e-clean` xoá hồ sơ, ảnh học sinh, ảnh mẫu trên S3.
- `e2e/config.spec.ts` gõ "ZZE2E THPT Nguyễn" vào ô tìm trường, vì trường e2e mới làm listbox che nút Tạo mã.

### Việc để lại

| Việc | Khi nào |
|---|---|
| MultiSelect giữ listbox mở sau khi chọn, listbox che nút ở chân hộp thoại | Khi sửa form |
| Object S3 mồ côi: điện thoại xin link PUT rồi không báo ghi, hoặc xoá object sau commit lỗi (chỉ ghi log). Chưa có job dọn | Giai đoạn 6 hoặc 7 |
| Giai đoạn 6 phải nghe kênh `photo_checks` và thêm unique `(customer_bank_id) where status = 'pending'` | Giai đoạn 6 |
| Production phải chạy `scripts/s3-cors.ts` với `STUDENT_ORIGIN` thật | Giai đoạn 7 |
| Quét QR bằng camera ở H0, màn H1, màn trường đã đóng chưa có e2e; hàm quyết định đổi trường có test unit | Khi viết e2e quay video |
| Nén ảnh trên trình duyệt chỉ có test unit cho vòng lặp; e2e tải một ảnh JPG nhỏ | Khi viết e2e quay video |
| Dev server chạy lâu có lúc ngừng nạp lại file server sau khi sửa; tắt và chạy lại `bun dev` trước khi chạy e2e | Ghi nhớ |
