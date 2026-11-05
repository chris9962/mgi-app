# Giai đoạn 6: Worker nén ảnh và kiểm ảnh

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** ảnh học sinh nộp được nén lại ở máy chủ; máy đọc chữ trên ảnh và báo khung nào thấy đủ họ tên, mã giới thiệu.

**Thiết kế gốc:** luật "Worker nén ảnh", "Xếp lượt kiểm ảnh", "Worker kiểm ảnh" ở mục `id="du-lieu"` của `../Mở tài khoản học sinh qua QR trường.html`. Code tham khảo trong mgst-app: `scripts/photo-check-worker.ts`, `src/server/photoCheck.ts`, `src/server/ocr/reader.ts`, `src/server/ocr/text.ts`, `src/server/ocr/facts.ts`, `scripts/ocr-server.py`, `src/components/banking/PhotoCheckPanel.tsx`. Chép, không import.

## Quyết định đã chốt

- Worker nén: ảnh có `compressed_at` rỗng và `compress_attempts < 3`. Ảnh quá 300 KB hoặc chưa phải webp thì tải về, ép webp cạnh dài 1600 (`sharp`, HEIC qua `heic-convert`), ghi lên S3. Ảnh đã đạt thì chỉ ghi `compressed_at`. Lỗi 3 lần thì giữ ảnh gốc. Đổi đuôi khoá thì cập nhật `s3_key` và xoá object cũ, ghi ruling nếu chọn cách khác.
- Kiểm ảnh chỉ kiểm họ tên và mã giới thiệu, không kiểm số tài khoản. Mỗi khung bật `check_name`, `check_code` ở hộp thoại Hướng dẫn. Worker chỉ đọc ảnh đang dùng của đúng khung đó, không đoán màn, không tìm sang ảnh khác.
- Họ tên so với `customers.full_name` sau khi bỏ dấu, viết hoa, bỏ khoảng trắng; đúng từng chữ cái; dòng chữ trên ảnh được dư tối đa 2 chữ cái mỗi đầu (chép `lineHasName`).
- Mã giới thiệu so nguyên văn với `customer_banks.referral_code`, chỉ bỏ dấu và viết hoa; không gộp O với 0, I với 1; trước sau mã không dính chữ hay số (chép `linesHaveExactCode`). Mã có O, I, 0, 1 thì đọc lại vùng đó bằng model thứ hai như mgst-app. Không cho sai ký tự.
- Không trích giá trị trên ảnh để hiện. Không thấy thì ghi "Không tìm thấy ..." kèm giá trị hệ thống.
- Hàng chờ `photo_checks`: Gửi kiểm tra, Tải ảnh thay thế, sửa họ tên đều xếp lượt (xoá dòng pending cũ của dòng ngân hàng đó, thêm dòng mới, `pg_notify`). Thêm unique `(customer_bank_id) where status = 'pending'`. Worker nghe `LISTEN`, quét lại mỗi 30 giây, mỗi vòng 20 lượt. Lượt bị thay trong lúc đọc thì bỏ kết quả. Lỗi máy thì ghi `failed` kèm lý do, không thử lại.
- `result` jsonb: mỗi khung có bật kiểm một mục (khung, tên khung, giá trị hệ thống, đạt hay không, câu lý do). `passed`, `total` là số khung đạt trên số khung có bật kiểm.
- Kết quả chỉ để gợi ý, worker không đổi trạng thái `customer_banks`. Học sinh không thấy kết quả.
- Giao diện: khối "Xác thực ảnh" trong khối ngân hàng ở Trang 4 (mỗi khung một dòng Đạt hoặc Không đạt, "Hệ thống: ...", câu lý do, thời điểm kiểm), dòng "Xác thực ảnh x/y" ở Trang 3, bộ lọc kết quả xác thực ảnh ở Trang 3.
- Môi trường OCR local: `OCR_PYTHON=~/.mgst-ocr/bin/python` (Python 3.11 có sẵn PaddleOCR, VietOCR). Worker chạy container riêng ở giai đoạn 7.

## Việc để lại từ giai đoạn trước thuộc giai đoạn này

- `photo_checks` chưa có unique pending: thêm migration.
- Ảnh nén lỗi 3 lần vẫn nằm trong chỉ mục hàng chờ nén: worker phải lọc `compress_attempts < 3`.

## Task

- [x] **Task 1: Worker nén ảnh.** `scripts/compress-worker.ts`, nghiệp vụ ở `src/server/compress.ts`. Test S3 trên bucket dev: ảnh png lớn thành webp nhỏ hơn 300 KB, cạnh dài 1600; ảnh đã đạt không đổi; lỗi 3 lần thì dừng.
- [x] **Task 2: Hàm so chữ.** Chép `text.ts` cần dùng. Test unit với chữ OCR mẫu: tên dính khoảng trắng, tên dư chữ, mã AT105 với AT1050, O với 0.
- [x] **Task 3: Xếp lượt và worker kiểm ảnh.** Migration unique pending, `src/server/photoCheck.ts`, `src/server/ocr/reader.ts`, `scripts/ocr-server.py`, `scripts/photo-check-worker.ts`. Test DB: xếp lượt thay lượt cũ, kết quả ghi đúng `passed`/`total`, lượt bị thay thì bỏ. Test tích hợp với OCR thật (bỏ qua nếu thiếu `OCR_PYTHON`): ảnh sinh từ chữ (vẽ họ tên và mã lên ảnh bằng sharp hoặc canvas) đọc ra đạt.
- [x] **Task 4: Giao diện.** Khối Xác thực ảnh ở Trang 4, dòng x/y và bộ lọc ở Trang 3. E2E: học sinh nộp ảnh có chữ họ tên và mã, chạy worker một vòng (`--mot-vong`), Trang 4 hiện Đạt.

Cuối giai đoạn chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.

## Kết quả

Agent làm xong 4 task ngày 2026-11-05, commit 1d278eb tới commit ghi mục này, trên nhánh `dev`.

### Đã làm

- Worker nén ảnh (`src/server/compress.ts`, `scripts/compress-worker.ts`, `bun compress:worker`): lấy ảnh có `compressed_at` rỗng và `compress_attempts < 3`, cũ nhất trước, 20 ảnh một vòng. Ảnh webp dưới 300 KB chỉ ghi `compressed_at`. Ảnh khác tải về, ép webp cạnh dài 1600 (chất lượng 85, 80, 75, 70, dừng ở bậc đầu lọt trần), HEIC đổi sang JPEG bằng `heic-convert` trước. Khoá mới giữ thư mục, ngày, uuid và đổi đuôi sang `.webp`; ảnh đã là webp thì ghi đè đúng khoá. Object gốc xoá sau commit. Lỗi thì tăng `compress_attempts`, đủ 3 lần thì dừng, ảnh gốc giữ nguyên.
- `src/server/storage.ts` thêm `readImage` (object không còn thì trả null) và `writeImage`.
- Hàm so chữ (`src/server/ocr/text.ts`) chép `lineHasName`, `linesHaveExactCode` của mgst-app, bỏ dấu bằng `removeDiacritics` có sẵn.
- Migration 0004: unique `photo_checks (customer_bank_id) where status = 'pending'` và cột `photo_checks.claimed_at`.
- Đọc chữ: `scripts/ocr-server.py` (PaddleOCR `PP-OCRv5_mobile_det` dò vùng, VietOCR `vgg_transformer` đọc, `PP-OCRv6_medium_rec` đọc lại vùng mã lệch O/0, I/1) và `src/server/ocr/reader.ts` giữ một tiến trình Python suốt đời worker.
- Worker kiểm ảnh (`src/server/photoCheckWorker.ts`, `scripts/photo-check-worker.ts`, `bun photo-check:worker`): nghe `LISTEN photo_checks` (kênh app đã gọi `pg_notify`), quét lại mỗi 30 giây, 20 lượt một vòng. Mỗi khung chưa bỏ có bật `check_name` hoặc `check_code` đọc ảnh đang dùng của chính khung đó. Kết quả ghi đúng dạng `PhotoCheckItem` của `src/lib/photoCheck.ts`, `passed`/`total` đếm khung. Câu lý do không trích chữ trên ảnh. Worker không đổi trạng thái `customer_banks`.
- Hai worker có cờ `--mot-vong` và dừng sạch khi nhận SIGTERM: làm nốt ảnh hoặc lượt đang xử lý rồi thoát mã 0.
- Giao diện: nhãn Không đạt trong khối Xác thực ảnh ở Trang 4 dùng tông cảnh báo có dấu "!" như thiết kế, khác màu đỏ của lượt người quản bấm Không đạt. Token `--warn`, `--warn-ink` cho bộ sáng và tối.
- `OCR_PYTHON` có trong `.env.local` (`~/.mgst-ocr/bin/python`) và `.env.example` (rỗng). Thêm `sharp`, `heic-convert`, `@types/heic-convert`.

### Test

- `bun run test`: 139 pass. `bun test:db`: 176 pass. `bun test:s3`: 22 pass. `bun run e2e`: 15 pass. `bunx tsc --noEmit`: sạch. `bun run lint`: 0 lỗi, 2 cảnh báo `<img>` có từ giai đoạn 3.
- Test S3 nén ảnh trên bucket `mgi-bank-dev`: png 2400x3200 thành webp dưới 300 KB cạnh dài 1600; webp đã đạt giữ nguyên; webp quá 300 KB ghi đè đúng khoá; HEIC (dựng bằng `sips` của macOS) thành webp; lỗi 3 lần thì dừng; hai worker cùng nén một ảnh chạy song song thật bằng `Promise.all`, chỉ một bên nén. Test xoá mọi object đã tạo.
- Test DB kiểm ảnh dùng ảnh giả là chữ UTF-8 và OCR giả: xếp lượt thay lượt cũ, DB từ chối lượt pending thứ hai, `passed`/`total` và từng mục `result`, khung chưa có ảnh, dòng không có mã chữ, ngân hàng tắt hết khung kiểm, lượt bị thay trong lúc đọc (OCR giả xếp lượt mới giữa chừng, ép thứ tự chắc chắn), hai worker cùng nhận một lượt (`Promise.all`), lượt giữ quá 5 phút, lỗi máy ghi `failed` không thử lại, ảnh vừa bị nén đổi khoá thì đọc lại khoá mới.
- Test OCR thật (`tests/s3/photoCheckOcr.test.ts`, bỏ qua khi thiếu `OCR_PYTHON`) và e2e vẽ chữ lên ảnh bằng sharp lúc chạy, không lưu ảnh vào repo.
- Kiểm đột biến, agent trả code về sau mỗi lần: bỏ khoá dòng ở worker nén thì test hai worker fail; bỏ lọc `compress_attempts < 3` thì test lỗi 3 lần fail; bỏ điều kiện giữ lượt thì 3 test fail; ghi kết quả theo dòng ngân hàng thay vì id lượt thì test lượt bị thay fail; bỏ lượt đọc lại khoá thì test ảnh vừa nén fail; xoá unique index thì test lượt pending thứ hai fail; bỏ so mã thì e2e fail ở dòng "Xác thực ảnh 0/1".

### OCR đo trên ảnh sinh từ chữ

- Ảnh màn hình giả 900x1600, chữ Arial, nền trắng. Nạp model khoảng 10 giây, mỗi ảnh khoảng 1 giây trên máy local.
- 6 họ tên có dấu đọc đúng cả dấu: TRẦN MINH ANH, NGUYỄN THỊ HỒNG NHUNG, Lê Văn Ổi, Phạm Quốc Đạt, Đỗ Thị Ánh Tuyết, Võ Hoàng Yến.
- VietOCR đọc sai cả 3 mã có O hoặc I: BO08 ra BOO8, OI10 ra 0110, MGI-O1I0 ra MGI-0110. Khi worker gửi kèm mã, PP-OCRv6 đọc lại đúng cả 3. Mã không có O, I đọc đúng: AT105, ND-TPB-01, AT106.
- Ca gần đúng AT1050 đọc ra đúng AT1050 và không đạt cho mã AT105. Tên thiếu một chữ (TRẦN MINH AN) không đạt.
- E2E: 2 ảnh qua bước nén của trình duyệt đọc đúng (HS-VPBANK-01 đạt, HS-TPBANK-010 không đạt cho HS-TPBANK-01).
- Tổng 15 ảnh (6 ảnh thử tay, 7 ảnh test tích hợp, 2 ảnh e2e): kết quả cuối đúng 15/15. Chưa đo trên ảnh chụp app ngân hàng thật.

### Ruling

- Plan ghi task dạng gạch đầu dòng nên script tách brief không chạy; brief của mỗi task là dòng task cộng mục Quyết định đã chốt.
- Worker kiểm ảnh tải ảnh theo id dòng ảnh; object không còn thì đọc lại `s3_key` một lần, vì worker nén đổi khoá rồi xoá object cũ. Hai worker không khoá chéo nhau.
- Worker nén khoá dòng `proof_photos` bằng `for update skip locked` suốt lúc tải, nén, ghi. Học sinh chụp lại hay nhân viên thay đúng ảnh đang nén phải chờ vài giây.
- Khoá mới chỉ đổi đuôi sang `.webp`; ảnh đã là webp mà quá 300 KB thì ghi đè đúng khoá như thiết kế ghi "ghi đè lên S3".
- "Ảnh đã đạt" xét theo `size_bytes <= 300 KB` và đuôi `.webp`, không đo cạnh dài.
- Worker nén chỉ quét mỗi 30 giây, không nghe LISTEN: thiết kế không nêu kênh cho nén và ảnh gốc xem được ngay.
- Nén ra vẫn quá 300 KB ở chất lượng 70 thì vẫn ghi bản đó, như mgst-app.
- Chép nguyên `lineHasName`, kể cả nhánh tên nối liền "chuyen tien" của lời nhắn chuyển khoản.
- Bỏ dấu dùng `removeDiacritics` có sẵn (đổi cả Ð, ð) thay vì chép `stripAccents`.
- Nửa worker đặt ở `src/server/photoCheckWorker.ts` thay vì `src/server/photoCheck.ts`: đã có `src/server/photoChecks.ts` (xếp lượt, app import), và file worker kéo theo tiến trình OCR nên route Next không được import.
- Thêm cột `photo_checks.claimed_at`. Worker nhận lượt bằng một câu update khi cột rỗng hoặc quá 5 phút, không giữ khoá dòng lúc đọc, để xếp lượt mới vẫn xoá được lượt đang đọc.
- Khung bật kiểm mà chưa có ảnh ghi Không đạt, lý do "Chưa có ảnh.". Khung đã bỏ không kiểm dù còn ảnh.
- Dòng ngân hàng không có mã chữ (mã chỉ có QR) thì bỏ phần so mã; khung chỉ kiểm mã thì không tính vào `total`.
- Lúc đọc mà ngân hàng không còn khung bật kiểm thì worker xoá lượt chờ, không ghi 0/0.
- Câu lý do khung đạt là thứ đã kiểm ("Họ tên", "Mã giới thiệu", "Họ tên và mã giới thiệu"). Khung không đạt ghi "Không tìm thấy họ tên X và mã giới thiệu Y trong ảnh." theo phần thiếu.
- `ocr-server.py` chọn vùng cần đọc lại bằng chuỗi đã bỏ ký tự ngoài chữ số, không theo cụm như mgst-app, vì mã có gạch nối như ND-TPB-01 tách thành 3 cụm và cách cũ không bao giờ đọc lại. So nguyên văn vẫn nằm ở `text.ts`.
- `reader.ts` bỏ `OCR_PROCESSES`, model seq2seq và `pad_y` của mgst-app; worker đọc tuần tự bằng một tiến trình.
- Worker kiểm ảnh mất kết nối LISTEN thì thoát mã 1 như worker SMS.
- SIGTERM thì làm nốt lượt đang đọc rồi thoát. Lượt đầu tiên còn phải nạp model khoảng 10 giây.
- Giai đoạn 5 đã có khối Xác thực ảnh ở Trang 4, dòng x/y và bộ lọc ở Trang 3. Task 4 chỉ thêm tông cảnh báo cho nhãn Không đạt của máy và e2e.
- Giữ thứ tự dòng của giai đoạn 5 (tên khung, câu lý do, Hệ thống) dù thiết kế đặt câu "Không tìm thấy" sau dòng Hệ thống, vì `result` chỉ có một câu lý do.
- Seed e2e bật `check_code` ở khung đầu của cả 3 ngân hàng để e2e kiểm được mã.

### Việc để lại

| Việc | Khi nào |
|---|---|
| Quay lại từ B3 đọc `s3_key` trước khi xoá dòng ảnh: worker nén đổi khoá đúng lúc đó thì object `.webp` mới thành rác trên S3 | Giai đoạn 7 cùng job dọn object mồ côi |
| Worker nén và worker kiểm ảnh chưa có container. Container kiểm ảnh cần Python có PaddleOCR, VietOCR, model tải sẵn (`ocr-server.py --tai-model`), đặt `OCR_PYTHON`, `OCR_CONFIG`, `OCR_WEIGHTS`, restart khi thoát, stop grace đủ cho lượt đang đọc | Giai đoạn 7 |
| Thiếu `OCR_PYTHON` thì worker gọi `python3`; máy không có thư viện thì mọi lượt ghi `failed` | Giai đoạn 7 |
| OCR mới đo trên ảnh vẽ chữ bằng Arial nền trắng, chưa đo trên ảnh chụp app ngân hàng thật của học sinh | Khi có ảnh thật |
| Worker kiểm ảnh đọc tuần tự một tiến trình, khoảng 1 giây một ảnh; nhiều học sinh gửi cùng lúc thì hàng chờ dài | Khi tải lớn |
| Ảnh webp dưới 300 KB mà cạnh dài hơn 1600 không được nén lại | Khi user cần |
| Lượt đọc quá 5 phút thì worker khác nhận lại và đọc trùng; kết quả vẫn chỉ ghi một lần | Khi chạy nhiều worker |
| Trang Vận hành hệ thống chưa hiện hàng chờ `photo_checks` | Giai đoạn 7 |


### Sửa theo review lần 1

Reviewer đọc giai đoạn 6 ngày 2026-11-05, thấy 4 lỗi Important và nâng 2 lỗi Minor lên, không có Critical. Agent sửa trong một lượt, commit 21c4f6a tới commit ghi mục này. Mỗi mục có test viết trước, thấy fail đúng lý do rồi mới sửa.

- I1 và Minor 7: hai worker nhận định dạng ảnh theo nội dung file (`imageExtOf`), không theo đuôi khoá. Worker kiểm ảnh đổi HEIC sang JPEG bằng `heic-convert` trước khi đưa OCR, vì OpenCV không mở được HEIC và ảnh thay thế HEIC được kiểm trước khi worker nén quét tới. Test OCR thật: ảnh HEIC dưới khoá `.heic` và `.jpg` chưa nén cho kết quả `done` (trước đó `failed`). Test S3: HEIC dưới khoá `.jpg` nén ra webp (trước đó `failed`).
- I2: nhánh "tên nối liền chuyen tien" chỉ đạt khi chữ trước tên khớp `^(NOIDUNG|LOINHAN)?[A-Z]{0,2}$`, phía sau có gì cũng được. Test unit: "NGUYEN TRAN MINH ANH chuyen tien" và "Noi dung: LE VAN TRAN MINH ANH chuyen tien den ban" không đạt cho Trần Minh Anh; "Noi dung: TRAN MINH ANH chuyen tien" và "TRAN MINH ANH chuyen tien" vẫn đạt.
- I3: `reader.ts` có thời gian chờ mỗi ảnh `OCR_TIMEOUT_MS` (mặc định 120 giây, dưới 5 phút giữ lượt). Quá giờ thì giết tiến trình Python, lượt đó ghi `failed` với lý do "Đọc ảnh quá 120 giây.", lượt sau mở tiến trình mới. Dòng trả lời có chữ rác dính trước JSON vẫn đọc được. Test unit trỏ reader sang OCR giả chạy bằng bun (`tests/support/fakeOcrServer.ts`): treo thì lỗi sau thời gian chờ và lượt sau đọc được, chết thì lượt sau mở lại, chữ rác vẫn đọc được.
- I4: worker nén nhận ảnh bằng một câu update tăng `compress_attempts` và ghi `compress_tried_at` (migration 0005), commit trước khi tải. Tải, nén, ghi S3 nằm ngoài transaction, không giữ khoá dòng. Kết quả ghi với điều kiện `s3_key` còn là khoá cũ; dòng đã đổi thì xoá ảnh vừa nén nếu không dòng nào trỏ tới. Tải và ghi S3 có thời gian chờ `COMPRESS_TIMEOUT_MS` (mặc định 60 giây), sharp giới hạn 100 MP. Test S3: số lần thử thấy được bằng 1 khi worker còn đang tải (trước đó 0); học sinh chụp lại lúc worker đang nén không bị chặn, dòng giữ ảnh mới, ảnh vừa nén bị xoá (trước đó chờ khoá tới lock timeout).
- M1: ảnh nén lỗi chờ 5 phút nhân số lần đã thử mới được lấy lại. Vòng có ảnh lỗi không chạy vòng kế ngay (`runAgainNow`). Test S3: sau lần lỗi thứ hai, 6 phút vẫn chưa được thử lại (trước đó được), 11 phút thì được.
- M8: hàng chờ nén và hàng chờ kiểm ảnh nhận danh sách trường, hai worker nhận cờ `--truong=<id>[,<id>]`; không truyền thì xử lý hết như cũ. Test hàng chờ, test script và e2e đều truyền trường của mình, nên không còn giả định dòng test nằm trong 20 dòng cũ nhất của DB local và không nén ảnh thật. Test: hàng chờ theo trường không có dòng của trường test khác; `--mot-vong --truong` không chạm ảnh, lượt của trường khác.

Ruling:

- Giữ nhánh CHUYENTIEN của `lineHasName` vì chủ dự án bảo làm tương tự mgst-app, nhưng chữ trước tên chỉ được là nhãn NOIDUNG hoặc LOINHAN cộng tối đa 2 chữ cái. Người điều phối chốt ngày 2026-11-05.
- Lần nén thành công cũng để `compress_attempts` bằng 1, vì lần thử ghi trước khi tải.
- Hạn thử lại là 5 phút nhân `compress_attempts` (5 phút sau lần 1, 10 phút sau lần 2). Cùng cột dùng làm hạn giữ ảnh đang nén.
- Phạm vi worker theo trường, không theo id hồ sơ, vì e2e chỉ biết sẵn id trường `E2E_STUDENT_SCHOOL_ID`.

Test sau lần sửa: `bun run test` 144 pass, `bun test:db` 177 pass, `bun test:s3` 29 pass, `bun run e2e` 15 pass, `bunx tsc --noEmit` sạch, `bun run lint` 0 lỗi (2 cảnh báo `<img>` cũ).

Việc để lại thêm:

| Việc | Khi nào |
|---|---|
| Lý do lỗi OCR ở Trang 4 còn chứa đường dẫn tạm của máy chủ, ví dụ "OCR lỗi: ValueError: Không mở được ảnh /var/folders/..." | Khi sửa Trang 4 |
| Gạch nối tính là ranh giới mã: mã `TPB-01` đạt trên dòng có `ND-TPB-01` | Khi có mã dạng này |
| Lỗi kết nối ngay sau khi câu ghi kết quả nén đã commit ở máy chủ: dòng trỏ ảnh webp mới, ảnh gốc không bị xoá và thành rác | Giai đoạn 7 cùng job dọn object mồ côi |
| Link xem ảnh của học sinh sống 1 giờ; worker nén xoá ảnh gốc thì link cũ trả 404 tới khi web tải lại hồ sơ | Khi user cần |
| `scripts/ocr-server.py` còn docstring chép từ mgst-app, AGENTS cấm docstring | Khi sửa file này |
| Lượt chờ bị worker xoá vì ngân hàng tắt hết khung kiểm thì Trang 4 hiện lượt cũ hơn, có thể tính theo họ tên cũ | Khi user cần |
| `heic-convert` giải mã HEIC trong JavaScript, không giới hạn được số điểm ảnh; ảnh 48 MP tốn khoảng 1,2 GB RAM | Giai đoạn 7 khi đặt RAM cho container |
