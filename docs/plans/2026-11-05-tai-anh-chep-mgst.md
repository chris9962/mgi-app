# Tải ảnh chép cơ chế mgst-app

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** mọi ảnh đi qua API của app. Máy chủ đổi ảnh sang WebP ngay lúc nhận, giống mgst-app. Bỏ presigned PUT cho ảnh học sinh, thư mục `uploads/`, CORS cho web học sinh và worker nén.

**Lý do:** chủ dự án chốt 2026-11-05: "tôi đã nói cơ chế upload ảnh copy mgst qua". Giai đoạn 4 và 6 làm theo cách khác (điện thoại tải thẳng S3, worker nén sau). Kế hoạch này đổi lại cho đúng.

**Thiết kế gốc:** luật "B3 gửi ảnh" và "Đổi WebP lúc nhận" ở mục `id="du-lieu"` của `../Mở tài khoản học sinh qua QR trường.html` (đã sửa ngày 2026-11-05). Quyết định ở mục "Tải ảnh chép mgst-app" của `../du-an-mo-tai-khoan-hoc-sinh/cau-hoi-kien-truc-2026-11-03.md`.

**Mẫu mgst-app (chép, không import, không sửa mgst-app):** `src/server/storage.ts` hàm `putImage`, `src/server/toWebpOnServer.ts`, `src/app/api/uploads/route.ts`, `src/lib/toWebpImage.ts`.

## Quyết định đã chốt

- Điện thoại vẫn nén bằng `src/lib/compressImage.ts`. Trình duyệt không mở được ảnh (HEIC trên Chrome Android) thì gửi nguyên file.
- `putImage` ở `src/server/storage.ts` chép cách làm của mgst-app. Hàm kiểm chữ ký file, gọi bản chép `toWebpOnServer`, rồi ghi S3:
  - cạnh dài tối đa 1600, trần 300 KB, bậc chất lượng 85, 80, 75, 70;
  - HEIC đi qua `heic-convert`, không đưa thẳng cho sharp;
  - ảnh đã là WebP trong trần thì giữ nguyên;
  - đổi lỗi thì giữ ảnh gốc;
  - trần file nhận vào 20 MB như mgst-app.
- Mọi đường tải ảnh gọi `putImage`: ảnh học sinh ở B3, ảnh thay thế ở Trang 4, ảnh mẫu, ảnh QR.
- `POST /api/customers/me/photos` nhận multipart: file ảnh và khung ảnh (ngân hàng, khung). Máy chủ giữ mọi điều kiện kiểm của `recordPhoto` hiện tại: hồ sơ chưa gửi, khung thuộc ngân hàng đã chọn, trường còn mở, khoá dòng như cũ. Ảnh cũ của khung bị thay thì xoá trên S3 sau khi commit.
- Ghi S3 trước, ghi DB sau. DB lỗi thì xoá object vừa ghi.
- Bỏ: route `POST /api/customers/me/photos/upload-url`, `presignPut`, thư mục `uploads` trong `src/lib/imageKey.ts`, `scripts/s3-cors.ts` và biến chỉ CORS dùng. `copyImage`, `headSize` bỏ nếu không còn chỗ nào dùng.
- Bỏ worker nén: `scripts/compress-worker.ts`, `src/server/compress.ts`, script trong `package.json`, test của worker nén. Migration mới bỏ các cột `compressed_at`, `compress_attempts`, `compress_tried_at` và chỉ mục hàng chờ nén của `proof_photos`. Production chưa có dữ liệu.
- Worker kiểm ảnh giữ nhánh đổi HEIC sang JPEG, vì ảnh đổi lỗi vẫn giữ bản gốc.
- Nginx: `client_max_body_size 20m` cho cả hai tên miền. Kiểm `docs/deploy.md` và Dockerfile của giai đoạn 7 không còn nhắc worker nén, CORS hay `uploads/`.
- Màn B3 giữ nguyên chữ và cách hiện "Đang tải ảnh".

## Task

- [x] **Task 1: `putImage` đổi WebP lúc nhận.** Chép `toWebpOnServer`. Test unit hoặc S3: PNG lớn thành WebP dưới 300 KB, cạnh dài 1600; WebP nhỏ giữ nguyên byte; HEIC thành WebP; file hỏng mang chữ ký ảnh thì giữ bản gốc; file quá 20 MB bị từ chối; file không phải ảnh bị từ chối.
- [x] **Task 2: B3 gửi file qua API.** Route multipart, nghiệp vụ ở `src/server/customerPhotos.ts`, `PhotoSlot.tsx` gửi file. Bỏ route xin link PUT. Test DB và S3: ảnh nộp xong có khoá `.webp` trong `proofs/`; hồ sơ đã gửi, khung không thuộc ngân hàng đã chọn, trường đã đóng đều bị từ chối và không để lại object; chụp lại xoá ảnh cũ; hai lần gửi cùng khung song song chỉ còn một dòng. E2E B3 chạy lại.
- [x] **Task 3: Ảnh thay thế, ảnh mẫu, ảnh QR.** Ba đường đều qua `putImage` mới. Test: nhân viên tải HEIC làm ảnh thay thế thì dòng ảnh mới có khoá `.webp`, lượt kiểm ảnh đọc được.
- [x] **Task 4: Bỏ worker nén và phần thừa.** Migration bỏ cột, bỏ code, script, test, biến môi trường. Sửa `docs/deploy.md`, Dockerfile, `deploy/` nếu còn nhắc. Ghi bảng "Việc để lại" của kế hoạch giai đoạn 4, 6, 7: các mục về `uploads/`, CORS, worker nén chuyển thành "Bỏ: tải ảnh chép mgst-app".

Cuối kế hoạch chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.

## Kết quả

Agent làm xong 4 task ngày 2026-11-05, commit a04b2ae tới commit ghi mục này, trên nhánh `dev`. Xen giữa có ba commit của người điều phối theo yêu cầu chủ dự án (963d80d, b055e59, 0bdec51), không thuộc kế hoạch này.

### Đã làm

- Task 1: `src/server/toWebpOnServer.ts` chép từ mgst-app: cạnh dài 1600, trần 300 KB, bậc chất lượng 85, 80, 75, 70, HEIC qua `heic-convert` trước sharp, WebP đã đạt giữ nguyên, đổi lỗi thì trả null. `putImage` kiểm chữ ký file, đổi WebP, ghi S3, trả khoá và dung lượng của object đã ghi. Trần ảnh 20 MB, trần `Content-Length` 22 MB.
- Task 2: `POST /api/customers/me/photos` nhận multipart (file, dòng ngân hàng, khung). `uploadPhoto` ở `src/server/customerPhotos.ts` kiểm hồ sơ chưa gửi và khung thuộc ngân hàng đã chọn trước khi ghi S3, rồi kiểm lại trong transaction có khoá dòng hồ sơ. DB từ chối hoặc lỗi thì xoá object vừa ghi. Ảnh cũ của khung xoá sau commit. `PhotoSlot.tsx` vẫn nén bằng `src/lib/compressImage.ts` rồi gửi FormData. Bỏ route xin link PUT, `presignPut`, `copyImage`, `headSize`, thư mục `uploads`.
- Task 2: `next.config.ts` đặt `experimental.proxyClientMaxBodySize` 22 MB. `src/proxy.ts` chạy cho mọi đường dẫn, và Next chỉ giữ 10 MB body khi có proxy: ảnh lớn hơn bị cắt, route trả 400.
- Task 3: ảnh thay thế ghi `size_bytes` theo object đã ghi. Ảnh mẫu, ảnh QR đi qua cùng `putImage`; HEIC đổi được thì thành WebP, HEIC hỏng thì bị từ chối. Câu báo trần ảnh ở trang quản lý đổi sang 20 MB.
- Task 4: migration 0008 bỏ `compressed_at`, `compress_attempts`, `compress_tried_at`, check số lần thử và chỉ mục `proof_photos_compress_queue`. Bỏ `src/server/compress.ts`, `scripts/compress-worker.ts`, `scripts/s3-cors.ts`, script `compress:worker`, test của worker nén. Worker kiểm ảnh đọc ảnh một lần, giữ nhánh đổi HEIC sang JPEG. `deploy/deploy.sh` bước 4/7 cho sharp đổi một ảnh sang WebP trong image mới trước khi chạy container thử. `docs/deploy.md` ghi app đổi WebP lúc nhận và ba trần dung lượng. Bảng "Việc để lại" của giai đoạn 4, 6, 7 đã ghi "Bỏ: tải ảnh chép mgst-app" cho các mục về `uploads/`, CORS, worker nén; mục thử sharp của giai đoạn 7 ghi Xong.

### Sửa ngoài kế hoạch

- `scripts/e2e-clean.ts` (780d275): câu chọn `customer_banks` ghép `or()` của hai điều kiện có thể rỗng. Không có hồ sơ và mã e2e thì `or()` trả undefined và `where(undefined)` chọn mọi dòng. Script khi đó xoá `review_events`, `customer_banks` và ảnh trên S3 của mọi hồ sơ thật. Lỗi có từ giai đoạn 4, 5. Các lượt e2e của agent ở Task 2 chạy bản lỗi này trước khi người điều phối báo, nên có thể chính các lượt đó đã xoá dòng ngân hàng và ảnh của 3 hồ sơ thử tay của chủ dự án. Agent không khôi phục được các dòng đó. Nay danh sách id rỗng thì không chọn gì. Test `tests/db/e2eClean.test.ts` dựng một hồ sơ không mang tiền tố test rồi chạy `cleanE2e`. Lượt RED chạy trên database tạm để không xoá dữ liệu thật, rồi agent xoá database tạm. `tests/db/helpers.ts` có cùng dạng `or()` nhưng luôn kèm `like()`, nên an toàn.

### Kiểm ở local

- `docker build --target runner .` đạt, image 204 MB. Trong image, `node_modules` có `sharp` và `@img/sharp-libvips-*`; `heic-convert` nằm trong chunk máy chủ của Next.
- Bước thử sharp của `deploy.sh` chạy trong image in "sharp: đổi được WebP, 44 byte", thoát mã 0.
- Container thử nối DB local và bucket `mgi-bank-dev`, nhận ảnh thật qua `POST /api/customers/me/photos` với Host học sinh. PNG 2400x3200 (1.135.449 byte) trả 201, ghi `proofs/<ngày>/<uuid>.webp` 1200x1600, 131.010 byte. HEIC 1200x1600 (146.013 byte) trả 201, ghi `.webp` 1200x1600, 127.072 byte. `size_bytes` khớp object. Agent đã xoá object, dữ liệu `ZZTEST`, container và image của lượt thử.
- Image dựng trên máy Mac arm64. Máy chủ x86_64 dựng bản `sharp` x64 riêng; bước thử của `deploy.sh` kiểm lại ở lần deploy đầu.

### Test

- `bun run test` 201 pass, `bun test:db` 197 pass, `bun test:s3` 28 pass, `bun run e2e` 19 pass, `bunx tsc --noEmit` sạch, `bun run lint` 0 lỗi (2 cảnh báo `<img>` cũ).
- Test mới: `tests/unit/toWebpOnServer.test.ts`; `tests/s3/photoUpload.test.ts` (route thật, S3 thật: PNG thành WebP, chụp lại xoá object cũ, hai lần gửi song song, hồ sơ bị gửi kiểm tra lúc đang ghi S3); `tests/s3/adminUpload.test.ts` (HEIC làm ảnh thay thế, lượt kiểm ảnh đọc được; ảnh mẫu, ảnh QR HEIC); `tests/db/photos.test.ts` viết lại theo `uploadPhoto`; `tests/db/e2eClean.test.ts`; e2e ảnh 15 MB qua dev server.
- Ca song song chạy thật: kho giả giữ hai request ở bước ghi S3 tới khi cả hai cùng tới, rồi thả cùng lúc để hai transaction tranh khoá dòng hồ sơ.
- Kiểm đột biến, agent trả code về sau mỗi lần: bỏ `for update` ở `uploadPhoto` thì test song song fail; bỏ nhánh xoá object khi DB lỗi thì test DB lỗi fail; chưa đặt `proxyClientMaxBodySize` thì e2e ảnh lớn trả 400.
- Dữ liệu không phải test còn nguyên sau mọi lượt chạy: 12 ngân hàng và ZZVPB, 61 khung ảnh (58 có ảnh mẫu), trường "ZZDEMO THPT Nguyễn Du", mã `ND-*-01`, tài khoản `admin`, hồ sơ chủ dự án đang thử ở trường ZZDEMO.

### Ruling

- Plan ghi task dạng gạch đầu dòng nên script tách brief không chạy; brief mỗi task là dòng task cộng mục Quyết định đã chốt.
- `putImage` giữ tham số `Uint8Array` của mgi-bank thay vì `File` của mgst-app, vì mọi nơi gọi đã có bytes.
- Ảnh mẫu, ảnh QR xét đuôi sau khi đổi: HEIC đổi được thì nhận, HEIC hỏng thì từ chối thay vì giữ bản gốc như mgst-app, vì Chrome Android của học sinh không hiện HEIC.
- Không đặt `limitInputPixels` cho sharp trong app, chép đúng mgst-app (mặc định của sharp khoảng 268 MP).
- `bodyTooLarge` dùng trần cố định 22 MB như route `/api/uploads` của mgst-app.
- Trường đã đóng không chặn nộp ảnh với học sinh đã giữ chỗ, dù dòng Task 2 ghi "trường đã đóng đều bị từ chối". `recordPhoto` cũ không kiểm trường mở. Kế hoạch giai đoạn 4 (sửa theo review 1) chốt học sinh đã giữ chỗ vẫn nộp ảnh và gửi kiểm tra. Trường đóng thì Quay lại bị chặn, nên chặn cả ảnh làm học sinh kẹt ở B3.
- Bỏ `requestChecksumCalculation: "WHEN_REQUIRED"` của S3Client: lý do duy nhất là presigned PUT, mgst-app cùng bản SDK không đặt. Test S3 ghi `PutObject` thật trên bucket dev đạt.
- "Không để lại object" kiểm bằng kho giả đếm lượt ghi (từ chối trước khi ghi S3) và bằng `readImage` trả null trên S3 thật (từ chối sau khi đã ghi).
- Route nộp ảnh trả 413 khi `Content-Length` quá 22 MB như mgst-app. Lỗi mạng ở điện thoại giữ câu cũ "Không tải được ảnh lên. Kiểm tra mạng rồi thử lại."
- Nginx giữ `client_max_body_size 22m` của giai đoạn 7 thay vì 20m như mục Quyết định ghi: ảnh 20 MB cộng phần bao multipart vượt 20 MB.
- Bỏ vòng đọc lại khoá ảnh ở worker kiểm ảnh và test "ảnh vừa bị worker nén đổi khoá", vì không còn code nào đổi `s3_key` của một dòng ảnh.
- Giữ `writeImage` ở `storage.ts` dù chỉ test dùng; kế hoạch chỉ bỏ `copyImage`, `headSize`.
- Bước thử sharp ở `deploy.sh` đổi một ảnh 8x8 sang WebP, không chỉ `require("sharp")` như mgst-app, để lộ cả lỗi thiếu libvips lúc chạy.

### Việc để lại

| Việc | Lý do, khi nào |
|---|---|
| App đổi HEIC bằng `heic-convert` trong JavaScript, không giới hạn số điểm ảnh; HEIC 48 MP tốn khoảng 1,2 GB RAM. Container app production không đặt trần RAM; bản test đặt trần 1 GB nên có thể chết với ảnh đó | Xong ở lượt sửa theo review lần 1: trần HEIC 50 MP, đổi HEIC từng ảnh một; giai đoạn 7 đặt `APP_MEMORY` 3g cho production, 2g cho bản test |
| Chủ dự án xác nhận luật trường đã đóng: học sinh đã giữ chỗ vẫn nộp ảnh (ruling ở trên) | Khi chủ dự án đọc kế hoạch này |
| 3 hồ sơ thử tay của chủ dự án mất dòng ngân hàng và ảnh vì lỗi `e2e-clean` trước khi sửa; agent không khôi phục được | Chủ dự án tạo lại nếu cần |
| `deploy.sh` không thử ghi S3: bỏ `requestChecksumCalculation` mới kiểm trên bucket dev | Lần deploy đầu: gửi một ảnh thật ở web học sinh rồi xem Trang 4 |
| Bước thử sharp mới chạy trên image dựng ở máy Mac arm64 | Lần deploy đầu trên máy chủ x86_64 |
| Ảnh HEIC máy chủ không đổi được thì giữ bản gốc; worker kiểm ảnh đổi lại bằng chính `heic-convert` nên nhiều khả năng cũng lỗi và ghi Lỗi kiểm | Khi gặp ca thật |
| `writeImage` ở `storage.ts` chỉ còn test dùng | Khi sửa file này |
| `replacePhoto` ở `src/server/review.ts` để lại object vừa ghi khi transaction ném lỗi; job dọn ảnh mồ côi xoá sau 24 giờ | Khi sửa ảnh thay thế (review lần 1, để lại) |
| Worker kiểm ảnh đổi HEIC gốc mà không kiểm trần điểm ảnh: HEIC vượt trần 50 MP mà app giữ bản gốc vẫn được worker giải mã khi kiểm ảnh. Container kiểm ảnh trần 4 GB và đổi từng ảnh một | Khi gặp ca thật, hoặc dùng chung `heicPixels` ở `photoBytes` |
| Ca HEIC của test OCR thật (`tests/s3/photoCheckOcr.test.ts`) còn dựng ảnh bằng `sips`, máy không có `sips` thì bỏ qua: ảnh cần chữ đọc được nên không dùng ảnh dựng sẵn 320x240 | Khi chạy test OCR trên Linux |

### Sửa theo review lần 1

Review mới trên af17493 không có lỗi Critical, có 1 lỗi Important. Người điều phối nâng 3 lỗi Minor và thêm 1 lỗi nhỏ. Mỗi mục một commit, từ 65172df tới commit ghi mục này. `test:db` và `test:s3` chạy trên database tạm `zz_test_upload`, vì agent khác dùng chung container Postgres.

- Important, trần điểm ảnh (65172df, a4f08ee). Route nộp ảnh mở cho học sinh không đăng nhập. Bản cũ giải mã ảnh HEIC 10240x10240 nền phẳng 48 KB mất 3,5 giây và 1,27 GB RAM, và giải mã PNG vài trăm byte khai 110 MP. Nay sharp đặt `limitInputPixels` 100 triệu. HEIC đọc kích thước ở hộp `ispe` trước khi gọi `heic-convert`, trần 50 MP. App đổi HEIC từng ảnh một, lượt lỗi không chặn hàng. Vượt trần thì giữ bản gốc như ảnh đổi lỗi. Test: PNG khai 110 MP và HEIC 8000x8000 trả null dưới 1 giây; HEIC 320x240 vẫn đổi; ba lượt đổi HEIC cùng lúc chạy lần lượt (bộ giải mã giả ghi giờ bắt đầu, giờ xong). RED: bản cũ đổi được cả hai ảnh quá lớn; khi chưa có hàng đợi, ba lượt bắt đầu cùng lúc.
- Promoted, lỗi ghi S3 (82828c3). `putImage` bắt lỗi `PutObject`, ghi log và trả "Không tải được ảnh lên kho lưu trữ. Thử lại sau ít phút." như `putToS3` của mgst-app. Test dựng máy S3 giả trả 500. RED: lỗi `InternalError` ném ra ngoài.
- Promoted, test HEIC phụ thuộc `sips` (b9f8d62). Ba test HEIC ở `tests/s3/storage.test.ts`, `tests/s3/adminUpload.test.ts` đọc `tests/fixtures/heic-320x240.heic` (2,7 KB). RED: giả lập máy không có `sips`, cả ba chạy 0 lần kiểm. GREEN: vẫn giả lập đó, cả ba kiểm đủ.
- Promoted, test `e2e-clean` (0b051d7, bb1b715). Test dừng ngay khi DB có trường, ngân hàng, mã hay tài khoản e2e, trước khi gọi `cleanE2e`. Hồ sơ thật dựng và xoá trong cùng test bằng try/finally. Kiểm trên database tạm: có dữ liệu e2e và đưa lại lỗi thì test cũ đạt và xoá dữ liệu e2e; test mới dừng ở bước kiểm đầu, dữ liệu e2e còn nguyên. Không có dữ liệu e2e và đưa lại lỗi thì test mới fail, hồ sơ vẫn được dọn.
- Minor, tên test (8bad12f). Test HEIC của OCR thật nay ghi "ảnh HEIC máy chủ không đổi được sang WebP". Test cấu hình chặn chữ "worker nén" trong code và test. RED: test chỉ ra đúng `tests/s3/photoCheckOcr.test.ts`.
- Để lại: `replacePhoto` để lại object khi transaction ném lỗi (bảng Việc để lại).

Ruling của lượt này:

- Trần điểm ảnh khác mgst-app có chủ đích: `/api/uploads` của mgst-app chỉ cho nhân viên đã đăng nhập, còn route nộp ảnh của mgi-bank mở cho mọi học sinh có link trường.
- Trần HEIC 50 MP, thấp hơn trần 100 MP của định dạng khác: một ảnh HEIC 48 MP tốn khoảng 1,22 GB khi đổi (đo ở giai đoạn 7), còn container app trần 3 GB. Điện thoại chụp tới 48 MP nên ảnh thật vẫn đổi được.
- Đổi HEIC từng ảnh một trong app, cùng lý do 1,22 GB cho mỗi ảnh 48 MP. Nginx cho 300 lượt gửi ảnh vào ngay, nên hai ảnh HEIC lớn đổi cùng lúc đủ làm app hết RAM. Ảnh khác HEIC vẫn đổi song song bằng sharp. Chi phí: học sinh gửi HEIC lúc đông phải chờ lượt.
- HEIC không có hộp `ispe` thì không giải mã, giữ bản gốc: chuẩn HEIF bắt buộc hộp này, ảnh thiếu nó là ảnh lạ.
- Ảnh dựng sẵn 10240x10240 (commit trong 65172df) thay bằng 8000x8000 (33 KB, 64 MP) ở a4f08ee, để một ảnh vượt trần HEIC mà vẫn dưới trần sharp.

Test sau lượt sửa: `bun run test` 220 pass, `bun test:db` 219 pass, `bun test:s3` 29 pass, `bun run e2e` 19 pass (chạy 23:13 tới 23:15, trước a4f08ee; e2e không gửi ảnh HEIC), `bunx tsc --noEmit` sạch, `bun run lint` 0 lỗi (2 cảnh báo `<img>` cũ).
