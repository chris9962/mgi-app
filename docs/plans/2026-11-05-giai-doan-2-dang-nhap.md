# Giai đoạn 2: Đăng nhập, tài khoản, phân quyền

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** trang quản lý có đăng nhập, khung sidebar, trang Tài khoản (Trang 13, 14, 15) và trang Cá nhân (Trang 2). Quyền kiểm ở máy chủ.

**Kiến trúc:** `src/proxy.ts` đọc tên miền rồi rewrite sang thư mục nội bộ `src/app/admin/...` hoặc `src/app/student/...`. Trang quản lý là server component, đọc người đăng nhập từ cookie. Thao tác ghi đi qua route `/api/admin/*`. Mọi kiểm quyền đi qua `src/lib/permissions.ts`.

**Công nghệ:** Next.js 16.2.12, Tailwind 4, Drizzle, zod, bcryptjs, `bun test`, Playwright.

**Thiết kế gốc:** Trang 1, 2, 13, 14, 15 và mục Vai và quyền trong `Minh group/Mở tài khoản học sinh qua QR trường.html`. Code chép từ mgst-app: `src/server/auth.ts`, `src/app/api/login/route.ts`, `src/components/brand/BrandPanel.tsx`, `src/fonts/`.

## Ràng buộc

- Phiên đăng nhập dài 1 năm (user chốt 2026-11-05). Không có ô Ghi nhớ đăng nhập. Bỏ cột `sessions.remember`.
- Sai mật khẩu 5 lần liên tiếp thì khoá 15 phút. Đếm lượt thử bằng một câu `update` nguyên tử trước khi băm, như mgst-app.
- Thông báo sai không tiết lộ tên đăng nhập nào có thật.
- 3 vai: Quản trị, Quản lý có mọi quyền. Nhân viên chỉ có quyền được cấp: `manage_banks`, `export_excel`, `schools`, `vouchers`. Quyền Phân quyền chỉ Quản trị và Quản lý có. Màn Hệ thống chỉ Quản trị.
- Phạm vi hồ sơ: Quản trị, Quản lý thấy toàn công ty. Nhân viên thấy hồ sơ có ngân hàng trong `user_managed_banks`.
- Giao ngân hàng cho người quản làm ở hộp thoại ngân hàng (giai đoạn 3), không làm ở hộp thoại tài khoản.
- Việc để lại từ giai đoạn 1 thuộc giai đoạn này: băm mật khẩu async, test DB kiểm `DATABASE_URL`, code ghi `updated_at`, đổi `staff_code` rỗng thành null, test khoá các ràng buộc duy nhất.
- Local: `admin.localhost:3100` là trang quản lý, `bank.localhost:3100` là web học sinh.

## Task 1: Khung giao diện và chia tên miền

**Files:** `src/proxy.ts`, `src/lib/hosts.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `src/fonts/*`, `public/brand/*`, `src/components/ui/*`, `tests/unit/hosts.test.ts`

- [ ] Test `routeFor(host, path)`: host admin trả `/admin<path>`, host bank trả `/student<path>`. Gọi thẳng `/admin/...` hoặc `/student/...` trả 404. Host lạ trả 404. `/_next` và file tĩnh đi thẳng.
- [ ] Viết `routeFor` và `proxy.ts`. Biến môi trường `ADMIN_HOST`, `STUDENT_HOST`.
- [ ] Chép font Google Sans, logo, ảnh thương hiệu từ mgst-app. Viết token màu sáng và tối trong `globals.css`, script đặt `data-theme` trước khi vẽ.
- [ ] Component: Button, TextField, PasswordField, Select, Checkbox, Dialog, Card, StatusTag, Logo, BrandPanel.

## Task 2: Phiên và đăng nhập

**Files:** `src/server/auth/session.ts`, `src/server/auth/login.ts`, `src/app/api/admin/login/route.ts`, `src/app/api/admin/logout/route.ts`, migration bỏ `sessions.remember`, `tests/db/login.test.ts`

- [ ] Test DB: sai 5 lần thì lần 6 nhận khoá dù mật khẩu đúng. Đúng mật khẩu khi chưa khoá thì bộ đếm về 0. Tài khoản tắt trả cùng lỗi với sai mật khẩu. Phiên hết hạn sau 1 năm.
- [ ] Viết `attemptLogin(username, password)` và `createSession`, `destroySession`, `currentUser`.

## Task 3: Phân quyền

**Files:** `src/lib/permissions.ts`, `tests/unit/permissions.test.ts`

- [ ] Test: Quản lý có mọi quyền trừ `system`. Nhân viên có đúng quyền được cấp. Nhân viên không có `users`. `customerScope` của Nhân viên là danh sách ngân hàng được giao.
- [ ] Viết `can(user, action)`, `customerScope(user)`.

## Task 4: Trang đăng nhập và khung trang quản lý

**Files:** `src/app/admin/login/*`, `src/app/admin/(shell)/layout.tsx`, `src/components/shell/*`

- [ ] Trang Đăng nhập chép bố cục mgst-app: cột form 4 phần, khối thương hiệu 6 phần.
- [ ] Khung: sidebar có nhóm thu gọn, TopBar, menu tài khoản có Thông tin cá nhân, Giao diện sáng hoặc tối, Đăng xuất. Mục menu chỉ hiện khi người dùng có quyền và trang đã có.
- [ ] Chưa đăng nhập thì chuyển về `/login`.

## Task 5: Trang Tài khoản

**Files:** `src/server/users.ts`, `src/app/api/admin/users/**`, `src/app/admin/(shell)/users/**`, `tests/db/users.test.ts`

- [ ] Test DB: tạo tài khoản trả mật khẩu một lần. Tên đăng nhập trùng bị từ chối. Quản lý không gán được vai Quản trị. Không tự khoá chính mình. Đặt lại mật khẩu xoá mọi phiên của người đó. Mỗi thao tác ghi `audit_log`.
- [ ] Danh sách: tìm theo tên, tên đăng nhập. Phân trang 15 dòng ở máy chủ.
- [ ] Hộp thoại Thêm, Sửa: Họ tên, Mã tài khoản, Số điện thoại, Tên đăng nhập, Vai, Chức danh hiển thị, Quyền.
- [ ] Trang chi tiết: thông tin, quyền, nút Sửa, Đặt lại mật khẩu, Khoá hoặc Mở khoá. Hộp thoại Mật khẩu mới có nút Chép.

## Task 6: Trang Cá nhân

**Files:** `src/server/profile.ts`, `src/app/api/admin/profile/**`, `src/app/admin/(shell)/profile/**`, `tests/db/profile.test.ts`

- [ ] Test DB: đổi mật khẩu sai mật khẩu hiện tại thì báo lỗi ở ô đó. Đổi xong thì xoá các phiên khác, giữ phiên đang dùng.
- [ ] Trang Cá nhân: thông tin, Sửa thông tin, Đổi mật khẩu. Hộp thoại Đổi mật khẩu có 3 ô, không đặt luật độ dài như mgst-app.

## Task 7: Test e2e

**Files:** `playwright.config.ts`, `e2e/auth.spec.ts`, `scripts/e2e-seed.ts`

- [ ] Sai mật khẩu 5 lần thì màn đăng nhập báo khoá 15 phút.
- [ ] Nhân viên đăng nhập rồi mở `/users` thì không thấy trang.
- [ ] Quản trị tạo tài khoản, đặt lại mật khẩu, đăng nhập bằng mật khẩu mới.
