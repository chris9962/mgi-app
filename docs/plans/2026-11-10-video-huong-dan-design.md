# Video hướng dẫn và e2e cho mọi tính năng

Thiết kế ngày 2026-11-10. Kế hoạch làm viết sau khi chủ dự án duyệt file này.

## Mục đích

Chủ dự án cho người dùng xem thẳng video e2e làm video hướng dẫn. Người xem có bốn nhóm:

- Học sinh mở tài khoản trên điện thoại.
- Nhân viên hậu kiểm, chỉ quản ngân hàng được giao.
- Manager.
- Quản trị.

Mọi tính năng phải có e2e phủ hết các ca rẽ nhánh. Tính năng lớn và ca lớn phải có video. Ca phụ nhỏ chỉ cần e2e, không cần video.

## Hiện trạng

Ba file rà ở `docs/plans/2026-11-10-video-huong-dan/` ghi từng tính năng, từng ca và độ phủ e2e của ca đó. Mã ca trong file này lấy từ ba file đó.

| File rà | Tính năng | Ca | Ca chưa có e2e |
|---|---|---|---|
| `hoc-sinh.md` | 21 | 196 | 52 |
| `cau-hinh.md` | 36 | 312 | 71 |
| `nghiep-vu.md` | 15 | 213 | 74 |

Video hiện có là 11 flow ở `e2e/flows/`, quay cho chủ dự án duyệt. Các video này không dùng được cho người dùng vì ba lý do:

- Video hiện chữ "ZZE2E", tên "E2E ...", tên đăng nhập `zz_e2e_*`.
- `bun run e2e:flows` seed cả dữ liệu ca biên. Danh sách chưa lọc hiện các tên như "Biên <script>alert(1)</script>".
- Video có khung chữ kỹ thuật: khoá S3, log worker, tầng đầu bảng Excel, tên bước kiểu "Trang 3", "worker".

## Quyết định của chủ dự án (2026-11-10)

- Video không lồng tiếng. Người dùng xem nguyên video e2e.
- Video giữ cách quay hiện tại. Góc trái trên ghi tên test và tên bước, góc phải dưới ghi tên thao tác.
  Ba file rà đề xuất tắt hai lớp chữ này. Quyết định của chủ dự án thay đề xuất đó: giữ hai lớp chữ.
- Video không được hiện chữ "ZZE2E". Tên trường, ngân hàng, người dùng, học sinh phải giống tên thật.
- Video quay ở tốc độ hiện tại. Khi chủ dự án cần dùng clip nào, Claude giảm tốc clip đó lúc chủ dự án yêu cầu.
- E2E chạy xong không dọn dữ liệu. Ảnh trên S3 để nguyên.

## Quyết định của Claude

Chủ dự án có thể sửa các mục dưới đây khi đọc.

### Dữ liệu video tách khỏi dữ liệu ca biên

- Video chạy trên DB riêng tên `mgibank_video`, cùng container `mgi-bank-db`.
- Mỗi lần chạy `bun run e2e:flows`, script tạo lại DB này từ đầu: xoá DB, tạo DB, chạy migration, chạy seed video.
  Nếu không tạo lại, lần chạy sau fail vì trùng mã ngân hàng, tên đăng nhập.
- Chạy xong, script không dọn. Dữ liệu nằm trong `mgibank_video` tới lần chạy sau.
- Server `next start` của lượt quay đọc `DATABASE_URL` trỏ tới `mgibank_video`.
- E2E ca biên (project `chromium`) giữ nguyên: DB local, tiền tố `ZZE2E`, dọn trước và sau khi chạy.
- Seed video là script riêng. Seed video không gọi `seedBusiness` và không tạo dữ liệu ca biên.

### Dữ liệu trong video

- Ngân hàng: 12 ngân hàng thật ở `scripts/data/banks.json`, kèm logo ở `scripts/data/bank-logos/`.
- Ba ngân hàng dùng trong video học sinh (MB Bank, VPBank, TPBank) có hướng dẫn mở tài khoản và khung ảnh.
  Chủ dự án chốt 2026-11-10: dùng nguyên bản hướng dẫn của mgst-app. DB local đã có bản này: MB Bank 5 khung, VPBank 6 khung, TPBank 5 khung.
  Video học sinh mở hai ngân hàng nộp đủ mọi khung, ví dụ VPBank và TPBank là 11 ảnh.
  Seed video chép chữ hướng dẫn, tên khung, cài đặt kiểm của từng khung vào một file JSON ở `scripts/data/`. Seed không đọc DB local.
- Chủ dự án chốt 2026-11-10: ảnh mẫu và ảnh học sinh nộp là ảnh do code tạo bằng `tests/support/bankScreen`, tên và số giả.
  Ảnh mẫu thật của mgst-app có họ tên, số tài khoản, SĐT của khách thật: không được chép vào repo, không được hiện trong video.
  Ảnh nộp của video kiểm ảnh tự động ghi đúng họ tên và mã giới thiệu để OCR đọc ra kết quả Đạt.
- Mã giới thiệu có ảnh QR. Seed tạo ảnh QR từ link mở tài khoản bằng thư viện `qrcode`.
- Trường, tài khoản nhân viên, học sinh mang tên người Việt bình thường. Tên đăng nhập dạng `lan.nguyen`.
- Link app PVI dùng `DEFAULT_PVI_APP_URL` của `src/server/settings.ts`.
- Chủ dự án chốt 2026-11-10: link Zalo là link giả. Claude chọn `https://zalo.me/0000000000`, vì số 0000000000 không phải số điện thoại của ai.

### Tên test, tên bước và khung chữ

- Tên test là tên video, không có "Flow N:". Ví dụ "Mở tài khoản hai ngân hàng".
- Tên bước là câu hướng dẫn. Tên bước dùng tên menu ("Hồ sơ học sinh", "Mã voucher"), không dùng "Trang 3", "worker", "e2e", "x/y".
- Khung chữ `note()` chỉ dùng cho hai việc:
  - Thao tác ngoài trình duyệt, ví dụ "Học sinh chụp màn hình app ngân hàng".
  - Kết quả người xem cần thấy, ví dụ tên file Excel vừa tải về.
- Khung chữ không ghi khoá S3, log worker, tầng đầu bảng Excel, link `localhost`.
- Hai lớp chữ của Playwright giữ nguyên như video hiện tại. Dòng đầu góc trái trên là đường dẫn file spec.
  Góc phải dưới ghi động từ tiếng Anh, giá trị đã gõ, link `localhost`. Luật cấm link `localhost` ở trên chỉ áp cho `note()`.
- Khung chương `chapter()` hiện khi đổi người thao tác, ghi tên và vai của người đó.
- Video do đúng vai của người xem thao tác. Video cho Manager thì tài khoản Manager thao tác, không dùng tài khoản Quản trị.

### Khổ màn

- Video học sinh: 390x844, `isMobile`.
- Video trang quản lý: 1366x768.
- Video trang quản lý trên điện thoại: 390x844.

### Thư mục

- Spec video ở `e2e/flows/<nhóm>/<mã>-<tên>.spec.ts`. Video ra `e2e/videos/<nhóm>/<mã>-<tên>.webm`.
- Nhóm: `hoc-sinh`, `chung`, `nhan-vien`, `quan-ly`, `quan-tri`.
- 11 flow cũ bỏ sau khi các video mới thay xong. Mọi điều kiện kiểm của flow cũ phải còn ở video mới hoặc ở spec ca biên.

### Lỗi app lộ ra khi viết test

Claude sửa app theo TDD: viết test, xem test fail, sửa code, xem test pass. Mỗi lỗi ghi vào báo cáo cuối.

## Danh sách video

25 video. Bước chi tiết của từng video nằm ở mục 4 của file rà ghi trong cột "Nguồn".

### Nhóm `hoc-sinh` (học sinh, điện thoại)

| Mã | Video | Nguồn |
|---|---|---|
| HS-1 | Mở tài khoản hai ngân hàng: quét QR trường tới gửi kiểm tra | `hoc-sinh.md` HS-1 |
| HS-2 | Đổi ngân hàng đã chọn | `hoc-sinh.md` HS-2 |
| HS-3 | Không chọn được hai ngân hàng: còn một ngân hàng, hết lượt, đã có mọi ngân hàng | `hoc-sinh.md` HS-3 |
| HS-4 | Mở lại web xem kết quả và mở app PVI | `hoc-sinh.md` HS-4 |
| HS-5 | Mở web không qua link, đổi trường, trường đã đóng, mất mạng | `hoc-sinh.md` HS-5 |

### Nhóm `chung` (mọi người dùng trang quản lý)

| Mã | Video | Nguồn |
|---|---|---|
| CH-1 | Đăng nhập và bị khoá | `cau-hinh.md` V-A |
| CH-2 | Trang Cá nhân: sửa thông tin, đổi mật khẩu, đổi giao diện | `cau-hinh.md` V-B |
| CH-3 | Trang quản lý trên điện thoại | `cau-hinh.md` V-I |
| CH-4 | Từ học sinh gửi ảnh tới nhân viên đánh dấu: màn học sinh và màn nhân viên đặt cạnh nhau | Bản ghép quay ngày 2026-11-09 ở scratchpad |

CH-4 quay hai trang cùng lúc rồi ghép bằng ffmpeg. Script ghép nằm trong repo.

### Nhóm `nhan-vien` (nhân viên hậu kiểm)

| Mã | Video | Nguồn |
|---|---|---|
| NV-1 | Hậu kiểm một hồ sơ: lọc, xem ảnh, đọc Xác thực ảnh, Đạt, Không đạt, đổi kết quả | `nghiep-vu.md` NV-1 |
| NV-2 | Sửa thông tin, ghi chú nội bộ, tải ảnh thay thế | `nghiep-vu.md` NV-2 |
| NV-3 | Trang Ngân hàng của nhân viên | `nghiep-vu.md` NV-3 |
| NV-4 | Tin SMS lỗi và Gửi lại | `nghiep-vu.md` NV-4 |
| NV-5 | Người khác vừa đánh dấu hay vừa thay ảnh | `nghiep-vu.md` NV-5 |
| NV-6 | Cấu hình ngân hàng mình quản: logo, hướng dẫn, mã giới thiệu | `cau-hinh.md` V-G |

### Nhóm `quan-ly` (Manager; Quản trị xem cùng)

| Mã | Video | Nguồn |
|---|---|---|
| QL-1 | Theo dõi hồ sơ học sinh: lọc, tìm, đánh dấu thay nhân viên | `nghiep-vu.md` QL-1 |
| QL-2 | Trang Ngân hàng: lọc, tìm, sắp xếp | `nghiep-vu.md` QL-2 |
| QL-3 | Mã voucher | `nghiep-vu.md` QL-3 |
| QL-4 | Xuất Excel | `nghiep-vu.md` QL-4 |
| QL-5 | Quản lý tài khoản | `cau-hinh.md` V-C |
| QL-6 | Trường | `cau-hinh.md` V-D |
| QL-7 | Ngân hàng: thêm có logo, đổi logo, người quản, hướng dẫn, tắt và bật lại | `cau-hinh.md` V-E |
| QL-8 | Kho mã giới thiệu | `cau-hinh.md` V-F |

### Nhóm `quan-tri` (Quản trị)

| Mã | Video | Nguồn |
|---|---|---|
| QT-1 | Cài đặt: mẫu SMS, link Zalo, link app PVI; web học sinh hiện QR Zalo và QR PVI | `cau-hinh.md` V-H, `hoc-sinh.md` mục 4 phần Quản trị |
| QT-2 | Vận hành hệ thống | `nghiep-vu.md` QT-1 |

## E2E cho ca nhỏ

- Mọi ca ghi "chưa có" ở cột E2E của ba file rà phải có e2e, trừ ca chờ chủ dự án quyết ở mục dưới.
- Ca chỉ kiểm một phần phải kiểm đủ.
- Ca nhỏ viết trong project `chromium`, ở spec ca biên đang có hoặc spec mới cùng nhóm.
- Ca có test DB nhưng chưa có e2e: viết e2e khi ca đó hiện trên màn hình. Ca chỉ gọi API giữ test API.

## Ngoài phạm vi

- Ca chờ chủ dự án quyết từ trước: B14 (trường chưa có mã), D8 (ngân hàng 0 khung ảnh), thời hạn request ở web học sinh,
  Manager sửa tài khoản Admin, trần độ dài tên, link có dấu cách, bộ đếm SMS khi tên trường dài.
  Danh sách đủ ở mục 3 của `hoc-sinh.md` (nhóm 6). Các ca này chỉ có e2e sau khi chủ dự án quyết.
- Giảm tốc video: chỉ làm khi chủ dự án yêu cầu clip cụ thể.
- Lồng tiếng, phụ đề, cắt ghép video.

## Để lại cho người làm

- Cách tạo lại DB `mgibank_video` và cách truyền `DATABASE_URL` cho server, seed, test.
- Cách chép video ra thư mục theo nhóm.
- Ca nào gộp vào video nào khi một ca thuộc nhiều video.
- Ô "Vượt 80%" ở Vận hành hệ thống: nếu code không có chỗ đặt số đo giả thì video bỏ bước đó và ghi lý do. Không thêm nhánh chỉ dành cho test vào code app.
- Thứ tự làm các nhóm.
