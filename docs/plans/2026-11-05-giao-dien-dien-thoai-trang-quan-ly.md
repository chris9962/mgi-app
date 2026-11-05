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

- [ ] **Task 1: Khung trang, sidebar trượt, thanh đáy.** Test unit cho hàm chọn mục thanh đáy theo quyền. E2E khổ 390x844: thanh đáy hiện, "Thêm" mở sidebar, chọn một mục thì sidebar đóng và chuyển trang, Esc đóng sidebar và trả focus; khổ 1366x768 không có thanh đáy.
- [ ] **Task 2: Thanh tiêu đề, bảng, bộ lọc, hộp thoại.** E2E khổ 390x844 cho từng trang quản lý mà tài khoản e2e mở được: `document.documentElement.scrollWidth` bằng `clientWidth`. Kiểm bằng mắt từng trang ở 390 px (chụp màn hình, không commit ảnh).

Cuối kế hoạch chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.
