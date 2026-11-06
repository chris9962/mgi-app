# Giao diện điện thoại cho trang quản lý

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** trang quản lý dùng được trên điện thoại. Cách làm chép mgst-app.

**Lý do:** chủ dự án mở trang quản lý trên điện thoại ngày 2026-11-05. Trang chỉ có bố cục máy tính: sidebar rộng cố định, nội dung bị ép còn khoảng 140 px, trang rộng 853 px trên màn 390 px. Chủ dự án chốt: "làm cách của mgst đi".

**Mẫu mgst-app (chép, không import, không sửa mgst-app):**
- `src/styles/_breakpoints.scss`: `$bp-mobile: 900px`, `$bp-narrow: 600px`.
- `src/components/layout/AppShell.tsx` và `.module.scss`: khung trang, dưới 900 px đổi sang cột, `min-height: 100svh`.
- `src/components/layout/Sidebar.tsx` và `.module.scss`: dưới 900 px sidebar là ngăn trượt từ mép trái, rộng `min(280px, 85vw)`, mặc định ẩn.
- `src/components/layout/BottomNav.tsx` và `.module.scss`: thanh nút cố định ở đáy, chừa `safe-area-inset-bottom`, nút cuối "Thêm" mở lại sidebar. Không có hàng hamburger ở đầu trang.
- `src/components/layout/TopBar.module.scss`: dưới 900 px lề nhỏ, tiêu đề co và cắt bằng dấu ba chấm; dưới 600 px nhóm công cụ xuống hàng riêng, phần cuối rộng hết thanh.
- `src/components/ui/RankTable.module.css`: bảng giữ nguyên, cuộn ngang trong khung; nút trên thiết bị cảm ứng cao tối thiểu 44 px.
- `src/components/ui/FilterButton.module.css`: dưới 600 px bảng lọc một cột, các mục lọc thành hàng cuộn ngang ở trên.
- Các comment trong những file đó giải thích vì sao dùng `svh` mà không dùng `dvh`, và lỗi WebKit với thanh địa chỉ. Đọc và giữ đúng cách làm.

## Quyết định

- Ngưỡng như mgst-app: 900 px cho bố cục điện thoại, 600 px cho màn hẹp. Trên 900 px giao diện giữ nguyên như hiện tại.
- Sidebar dưới 900 px: ngăn trượt, lớp phủ phía sau, đóng khi bấm lớp phủ, bấm Esc, hoặc chuyển trang. Mở thì focus vào ngăn, đóng thì trả focus về nút "Thêm". Không bẫy người dùng bằng bàn phím.
- Thanh đáy dưới 900 px gồm tối đa 3 trang nghiệp vụ người dùng có quyền, theo thứ tự: Hồ sơ học sinh (`/customers`), Ngân hàng (`/customer-banks`), Mã voucher (`/vouchers`), rồi nút "Thêm". Người không có quyền trang nào thì chỉ có "Thêm". Mục đang mở được đánh dấu bằng `aria-current="page"` và bằng hình, không chỉ bằng màu.
- Danh sách mục của thanh đáy lấy từ cùng nguồn quyền với sidebar (`src/components/shell/menu.ts`), không viết lại luật quyền.
- Nội dung trang chừa chỗ cho thanh đáy để dòng cuối không bị che.
- Không trang nào bị cuộn ngang cả trang ở khổ 390 px. Bảng rộng cuộn ngang bên trong khung Card.
- Hộp thoại rộng tối đa `100vw - 32px`, các form hiện đủ ở khổ 390 px.
- Chữ trên màn hình theo luật của AGENTS.md. Nhãn nút dùng đúng tên mục trong menu.

## Task

- [x] **Task 1: Khung trang, sidebar trượt, thanh đáy.** Test unit cho hàm chọn mục thanh đáy theo quyền. E2E khổ 390x844: thanh đáy hiện, "Thêm" mở sidebar, chọn một mục thì sidebar đóng và chuyển trang, Esc đóng sidebar và trả focus; khổ 1366x768 không có thanh đáy.
- [x] **Task 2: Thanh tiêu đề, bảng, bộ lọc, hộp thoại.** E2E khổ 390x844 cho từng trang quản lý mà tài khoản e2e mở được: `document.documentElement.scrollWidth` bằng `clientWidth`. Kiểm bằng mắt từng trang ở 390 px (chụp màn hình, không commit ảnh).

Cuối kế hoạch chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.

## Kết quả

Làm ngày 2026-11-05 trên nhánh `dev`. Commit của kế hoạch này: `5fe363b`, `42e50da`, `04a946f`, `4d6776c` và commit ghi kết quả này. Các commit xen giữa thuộc kế hoạch tải ảnh của agent khác.

### Đã đổi

- `src/components/shell/AppShell.tsx` (mới): khung trang giữ trạng thái ngăn trượt, dựng Sidebar, nội dung và thanh đáy. Dưới 900 px khung dùng `100svh`, nội dung chừa 52 px cộng vùng an toàn cho thanh đáy, lề nội dung 16 px.
- `src/components/shell/Sidebar.tsx`: dưới 900 px sidebar là ngăn trượt từ mép trái, rộng `min(280px, 85vw)`, cao `100svh`, có lớp phủ và nút "Đóng menu điều hướng". Bấm lớp phủ, bấm Esc hoặc chọn mục thì ngăn đóng và trả focus về nút Thêm. Ngăn mở thì khoá cuộn trang phía sau.
- `src/components/shell/BottomNav.tsx` (mới): thanh đáy cố định, chừa `safe-area-inset-bottom`, ép lớp GPU cho WebKit. Mục đang mở có `aria-current="page"`, chữ màu nhấn và vạch trên đầu.
- `src/components/shell/bottomNavItems.ts` (mới): chọn tối đa 3 mục Hồ sơ học sinh, Ngân hàng, Mã voucher từ kết quả `menuFor`, không có luật quyền riêng.
- `src/app/globals.css`: variant `mobile` (tới 900 px) và `narrow` (tới 600 px) chép `_breakpoints.scss`; utility `table-scroll` chép `.table-scroll` của mgst-app.
- 9 trang danh sách dùng `table-scroll` cho bảng; câu báo bảng rỗng canh trái dưới 900 px. Trang Vận hành dùng lưới một cột co được.
- `TopBar`: dưới 900 px lề 16 px, tiêu đề dài cắt bằng dấu ba chấm; dưới 600 px nhóm công cụ xuống hàng riêng. `SearchBox` và ô tìm của trang Tài khoản rộng hết hàng dưới 600 px.
- `FilterButton`: dưới 600 px bảng lọc rộng hết màn hình trừ hai mép 16 px, một cột, các mục lọc thành hàng cuộn ngang ở trên.
- Trên 900 px giao diện giữ nguyên. Hộp thoại không đổi vì đã có `max-w-[calc(100vw-32px)]`.

### Test

- Unit `tests/unit/bottomNavItems.test.ts`: thứ tự cố định, chỉ trang có quyền, không quyền thì rỗng.
- E2E `e2e/mobile.spec.ts`, 8 test: thanh đáy và nút Thêm, chọn mục thì ngăn đóng và chuyển trang, Esc và lớp phủ đóng ngăn, không quyền chỉ còn Thêm, không trang nào cuộn ngang ở 390 px (13 trang gồm hai trang chi tiết), ô tìm và bảng Bộ lọc nằm trọn màn hình, lề 16 px và câu báo bảng rỗng, hộp thoại nằm trọn bề ngang, khổ 1366x768 không có thanh đáy.
- Trước khi sửa, trang Trường rộng 605 px và trang Vận hành rộng 511 px ở màn 390 px.
- Chạy đủ: `bun run test` 224/224, `bun test:db` 220/220 và `bun test:s3` 29/29 trên DB tạm `zz_test_mobile` (đã xoá), `bun run e2e` 28/28, `bunx tsc --noEmit` sạch, `bun run lint` sạch (2 cảnh báo `<img>` có sẵn).
- Kiểm bằng mắt ở 390 px: 13 trang, bảng Bộ lọc, 4 hộp thoại thêm mới, hộp ghi chú ở trang chi tiết, ngăn trượt ở giao diện sáng và tối. Kiểm 1366 px: Hồ sơ học sinh, Mã giới thiệu, Tài khoản, bảng Bộ lọc không đổi.

### Ruling

- Helper đặt tên `bottomNavItems.ts`, không `bottomNav.ts`. macOS không phân biệt hoa thường, `./BottomNav` sẽ trỏ nhầm file.
- Ngưỡng khai bằng `@custom-variant` dạng `max-width` như mgst-app. `max-[900px]:` của Tailwind là "nhỏ hơn 900" nên lệch 1 px.
- Ngăn đóng thì `visibility: hidden` sau khi trượt xong. mgst-app để link ngoài màn hình vẫn nhận phím Tab.
- Mở ngăn thì focus nút "Đóng menu điều hướng", phần tử đầu của ngăn.
- Nút Thêm có `aria-expanded` và `aria-controls`, mgst-app không có.
- E2E điện thoại ẩn huy hiệu của dev server bằng init script. Huy hiệu nằm góc phải dưới, đè nút Thêm; bản chạy thật không có.
- Bảng dùng utility `table-scroll` (`position: relative`, `overflow-y: hidden`). Phần tử absolute trong bảng neo vào tài liệu và kéo trang rộng ra.
- Lề nội dung 16 px đặt một chỗ ở AppShell bằng `mobile:[&>main]:p-4`, không sửa `p-6` của từng trang.
- Dưới 600 px ô tìm rộng hết hàng, nút giữ bề ngang. "Phần cuối rộng hết thanh" của mgst-app là ô kỳ của thanh chào; ở mgi-bank ô tìm là ô nhập tương ứng.
- Thanh tiêu đề không dính đầu trang như mgst-app. Kế hoạch không yêu cầu, và ở điện thoại thanh cao khoảng 145 px.
- Dưới 600 px bảng Bộ lọc neo vào thanh tiêu đề. mgst-app nhờ Radix tự né mép; mgi-bank neo mép phải nút nên bảng trượt khỏi mép trái.
- Câu báo bảng rỗng canh trái dưới 900 px. Canh giữa trên bảng rộng hơn khung thì chữ bị cắt, rõ nhất ở trang Tin SMS lỗi.
- Không nâng mọi nút lên 44 px trên màn cảm ứng. Luật 44 px của mgst-app chỉ cho nút sắp xếp cột; control mới đều từ 44 px; nút 36 px cũ đạt WCAG 2.5.8 mức AA.
- Test thanh đáy không quyền dùng `zz_e2e_lock`. Chạy cả bộ thì `config.spec` giao ngân hàng cho `zz_e2e_staff`.

### Việc để lại

- Ngăn trượt đang mở mà xoay máy tính bảng sang khổ trên 900 px thì trang vẫn khoá cuộn. Người dùng bấm một mục sidebar hoặc Esc thì hết khoá. mgst-app cũng vậy.
- Menu tài khoản mở trong ngăn trượt: bấm Esc đóng cả menu lẫn ngăn.
- Trang chi tiết có tên quá dài: tiêu đề xuống hàng riêng thì vạch ngăn sau nút quay lại nằm lẻ ở cuối hàng trên. Dữ liệu hiện có chưa gặp.
- Ở dev server, huy hiệu của Next đè nút Thêm khi mở bằng điện thoại.

### Sửa theo review lần 1

Reviewer đọc bản `5a994a1`: không có lỗi Critical, có 3 lỗi Important. Coordinator nâng thêm 6 lỗi Minor vì chúng gặp thật khi dùng điện thoại. Mỗi mục một commit, kèm test e2e fail trước khi sửa.

1. Important, `566ec46`. Ngăn mở thì nội dung và thanh đáy `inert`: Tab không rơi vào chỗ bị ngăn che, trình đọc màn hình chỉ đọc ngăn. Đóng ngăn dùng `flushSync` rồi mới focus nút Thêm, vì thanh đáy còn inert tới lúc React vẽ lại.
2. Important, `07d54e1`. Dưới 900 px bảng Bộ lọc đứng ngay trên thanh đáy, cao tối đa phần màn còn lại, phần giá trị cuộn bên trong. Test ở 375x548 và 844x390.
3. Important, `2c9e3d6`. Dưới 600 px lời báo lỗi xuất Excel neo vào thanh tiêu đề, không neo vào nút. Test ở 360 px (Hồ sơ học sinh) và 390 px (Trường).
4. `36ff933`. Menu tài khoản trong ngăn: Esc đầu chỉ đóng menu, Esc sau mới đóng ngăn và focus nút Thêm. Menu nghe Esc ở pha capture và gọi `preventDefault`.
5. `d7dcd18`. Ngăn đóng khi chuyển trang bằng nút Quay lại. Trạng thái mở suy ra từ đường dẫn lúc bấm Thêm, không dùng effect.
6. `30a9534`. Khoá cuộn chuyển từ JavaScript sang CSS, chỉ áp dưới 900 px. AppShell nghe media query: lên bố cục máy tính thì bỏ trạng thái ngăn.
7. `cd31eda`. Biến `--bottom-nav-h` (57 px) dùng chung cho thanh đáy, phần chừa đáy của nội dung và bảng Bộ lọc. Nhãn một hàng, mục rộng theo nhãn.
8. `4eddfb4`. Dưới 900 px `body:has(dialog[open])` khoá cuộn như mgst-app. Trước đây lăn ở lớp phủ là trang phía sau trôi 600 px.
9. `75c072d`. Seed thêm tài khoản `zz_e2e_noperm` và hồ sơ "Phạm Thị Khổ Hẹp". Test tràn ngang luôn đo trang chi tiết hồ sơ. Thêm test "ngăn đóng thì Tab không vào ngăn" và "đóng ngăn thì hết khoá cuộn". Bỏ init script ẩn `nextjs-portal`.

Comment của effect ngăn trượt trong Sidebar viết lại thành lý do ở `d7820b9`. Comment của FilterButton viết lại trong `07d54e1`.

Ruling của lượt sửa:

- Dưới 900 px bảng Bộ lọc là khối cố định trên thanh đáy, không treo dưới nút nữa. mgst-app nhờ Radix né mép màn hình nhưng không né thanh đáy, nên không có cách để chép. Treo dưới nút thì phải đo chiều cao thanh tiêu đề bằng JavaScript. Sai thì trên màn cao, bảng nằm xa nút Bộ lọc.
- Mục thanh đáy rộng theo nhãn (`flex-auto`), không chia đều như mgst-app. Chia đều thì ở 320 px chữ "Hồ sơ học sinh" bị cắt. Sai thì các icon cách nhau lệch vài px.
- Hồ sơ cho test trang chi tiết nằm trong seed, test không dựng hồ sơ qua web học sinh. Seed nhanh hơn và không phụ thuộc web học sinh.
- Test inert đọc cây trợ năng của Chromium qua CDP, vì bộ chọn role của Playwright không xét `inert`.
- Lên khổ máy tính thì bỏ hẳn trạng thái ngăn. Xoay lại về điện thoại thì ngăn không tự mở lại.

Test sau lượt sửa: `bun run test` 226/226, `bun test:db` 225/225 trên DB tạm `zz_test_mobile` (đã xoá), `bun run e2e` 40/40 (`e2e/mobile.spec.ts` có 18 test), `bunx tsc --noEmit` sạch. `bun run lint` có một lỗi ở `e2e/flows/support.ts`: file chưa commit của agent làm video e2e. Bỏ thư mục `e2e/flows` thì lint sạch, còn 2 cảnh báo `<img>` có sẵn.

Việc để lại sau review lần 1:

- Trong "Việc để lại" ở trên, ba mục đã xong: khoá cuộn khi xoay máy (mục 6), Esc ở menu tài khoản (mục 4), huy hiệu dev server (commit `9c88d32`).
- Trang chi tiết có tên quá dài: vạch ngăn sau nút quay lại vẫn có thể nằm lẻ cuối hàng trên.
- `env(safe-area-inset-bottom)` bằng 0 khi thẻ viewport thiếu `viewport-fit=cover`, nên thanh đáy chưa chừa vùng cử chỉ của iPhone. mgst-app cũng vậy.

### Sửa theo review lần 2

Reviewer đọc bản `a69e386`: 9 mục của lần 1 đúng, có 1 lỗi Important mới do mục 5 gây ra. Coordinator thêm 2 lỗi Minor và 1 đề xuất. Mỗi mục một commit. Test e2e viết trước; lúc đó agent quay video đang giữ e2e, nên bằng chứng RED chạy sau trên code trước khi sửa.

1. Important, `55f1751`. Ngăn đã đóng vì chuyển trang không tự mở lại khi về đúng trang cũ. Trước đây mở ngăn ở `/customers`, bấm Quay lại, rồi bấm lại Hồ sơ học sinh (hoặc bấm Tới) là ngăn bật lại kèm nội dung inert và khoá cuộn. Lúc render thấy đã sang trang khác thì AppShell bỏ hẳn trạng thái, không dùng effect.
2. `5bbdc56`. Trạng thái ngăn so cả đường dẫn lẫn chuỗi lọc (`useSearchParams`). Quay lại từ `/customers?status=new` về `/customers` cũng đóng ngăn. Trang quản lý đọc cookie nên render động, `useSearchParams` không cần bọc Suspense.
3. `9846c6d`. Dưới 900 px, mở Bộ lọc thì focus vào mục lọc đang chọn, không nằm ở nút bị bảng che. Xong và Esc vẫn trả focus về nút. Chuỗi media query 900 px dùng chung ở `src/lib/breakpoints.ts`.
4. `4b185b1`. Bảng Bộ lọc chỉ đứng trên thanh đáy khi màn thấp (variant `dock`: rộng tới 900 px và cao tới 780 px). Màn cao thì bảng treo ngay dưới nút; ở màn hẹp bảng neo vào thanh tiêu đề như trước lần sửa 1.

Bằng chứng RED→GREEN: chạy test mới trên file của commit trước khi sửa thì fail, trên HEAD thì pass. Mục 1 chạy trên `a69e386`, mục 2 trên `55f1751`, mục 3 trên `5bbdc56`, mục 4 trên `9846c6d`.

Số đo cho ngưỡng 780 px. Bảng Bộ lọc được đo ở chế độ treo dưới nút, tại 4 trang có Bộ lọc.

| Khổ | Đỉnh bảng | Phần ngoài khung giá trị | Cần cao tối thiểu (khung giá trị 420 px) | Cần với nội dung hiện có | Kết quả |
|---|---|---|---|---|---|
| 375x548 | 152 | 124 | 761 | 633 | đứng trên thanh đáy |
| 390x844 | 152 | 124 | 761 | 633 | treo dưới nút |
| 844x390 | 60 | 63 | 608 | 480 | đứng trên thanh đáy |
| 820x1180 | 60 | 63 | 608 | 480 | treo dưới nút |

"Cần cao tối thiểu" là đỉnh bảng cộng phần ngoài khung giá trị, cộng khung giá trị cao nhất 420 px, cộng 8 px khe và 57 px thanh đáy.

Ruling của lượt sửa:

- Ngưỡng `dock` là cao tới 780 px. Màn hẹp cần 761 px cho trường hợp khung giá trị cao nhất, nên lấy 780 để dư 19 px. Màn 600 đến 900 px chỉ cần 608 px, nhưng một ngưỡng chung dễ hiểu hơn. Cái giá: màn rộng 600 đến 900 px, cao 609 đến 780 px vẫn đứng trên thanh đáy dù treo được.
- Lưới của bảng Bộ lọc có `grid-rows-[minmax(0,1fr)]` ở mọi khổ, để khi đứng trên thanh đáy hàng nút không bị cắt. Ở máy tính, hàng `1fr` trong lưới cao tự động vẫn cao theo nội dung và giãn tới `min-h-[220px]`. Ảnh chụp ở 1366 px cho thấy bảng không đổi.
- Focus chỉ chuyển vào bảng khi màn dưới 900 px, đúng như review yêu cầu. Máy tính giữ cách cũ.

Test sau lượt sửa:
- `bun run test`: 227/227.
- `bun test:db`: 225/225, trên DB tạm `zz_test_mobile` (đã xoá).
- `bun run e2e`: 44/44. Trong đó `e2e/mobile.spec.ts` có 22 test.
- `bun run e2e:flows`: 11/11, gồm flow 11 trang quản lý trên điện thoại. Video được quay lại.
- `bunx tsc --noEmit` sạch.
- `bun run lint` sạch, còn 2 cảnh báo `<img>` có từ trước.

Việc để lại sau review lần 2: không có việc mới. Hai mục còn lại của lần 1 (vạch ngăn ở trang chi tiết có tên dài, `viewport-fit=cover`) vẫn như cũ.

### Sửa theo review lần 3

Reviewer đọc bản `435701e`. Mục 1, 2, 3 của lần 2 đúng, không có vòng render, `useSearchParams` không cần Suspense. Mục 4 gây lại 1 lỗi Important.

1. Important, `bc6e1f1`. Ở khổ rộng 601 tới khoảng 663 px và cao trên 780 px, bảng Bộ lọc rộng 520 px neo vào mép phải nút nên tràn mép trái. Nút "Bỏ hết bộ lọc" và nhãn mục lọc bị cắt. Sửa: dưới 900 px bảng neo vào thanh tiêu đề, cách mép phải 16 px (`mobile:static`, `mobile:right-4`). Test "Bộ lọc dưới 900 px" thêm khổ 601x900, 640x900 và kiểm bảng nằm trọn trong màn. Test fail ở 601x900 trên `435701e`, pass trên `bc6e1f1`.

Test sau lượt sửa: `bun run test` 227/227, `bun run e2e` 44/44, `bunx tsc --noEmit` sạch, `bun run lint` sạch (2 cảnh báo `<img>` có từ trước). Không chạy lại `bun test:db` và `e2e:flows`: lượt sửa chỉ đổi lớp CSS ở khổ 600 tới 900 px, flow 11 chạy ở 390 px.

Việc để lại sau review lần 3:

- Biến `location` ở `src/components/shell/AppShell.tsx` trùng tên biến toàn cục `window.location`. Code chạy đúng, đổi tên thì dễ đọc hơn.
- Bàn phím ảo khi gõ ô tìm trong bảng Bộ lọc đang đứng trên thanh đáy: chưa kiểm trên iPhone và Android thật.
- Hai mục còn lại của lần 1 vẫn như cũ.
