# Trang Ngân hàng trong nhóm Nghiệp vụ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** trang mới "Ngân hàng" trong nhóm Nghiệp vụ. Mỗi ngân hàng học sinh đã chọn là một dòng: học sinh chọn 2 ngân hàng thì có 2 dòng.

**Lý do:** chủ dự án yêu cầu ngày 2026-11-05: "nghiệp vụ thêm 1 page nữa => Ngân hàng show danh sách ngân hàng trong hệ thống. Ngân hàng 1, Ngân hàng 2 sẽ là 2 row trong đó, xem mgst-app sẽ hiểu page ngân hàng có gì".

**Mẫu mgst-app (chép bố cục, không import, không sửa mgst-app):** `src/app/(app)/banking/page.tsx`. Trang đó liệt kê mỗi tài khoản ngân hàng một dòng, có ô tìm theo tên, nút Bộ lọc, nhãn bộ lọc đang bật, Xuất Excel, phân trang ở máy chủ, sắp theo ngày.

## Quyết định

- Route `/customer-banks`, tiêu đề và mục menu "Ngân hàng", nằm ngay dưới "Hồ sơ học sinh" trong nhóm Nghiệp vụ. Quyền `customers`, như Trang 3.
- Phạm vi theo luật có sẵn: Quản trị, Quản lý thấy mọi dòng. Nhân viên chỉ thấy dòng của ngân hàng mình quản (dùng `scopedBankIds`, `reviewsBank` của `src/server/customerList.ts`).
- Mỗi dòng là một dòng `customer_banks`. Cột chép theo mgst-app, đổi cho đúng mgi-bank:

| mgst-app | mgi-bank | Ghi chú |
|---|---|---|
| Ngày | Ngày | Ngày tạo hồ sơ học sinh (`customers.created_at`), giờ Việt Nam, như cột Ngày của Trang 3 |
| Ngân hàng | Ngân hàng | Tên ngân hàng, link sang Trang 4 của học sinh |
| Khách hàng | Học sinh | Họ tên, link sang Trang 4; dòng dưới ghi lớp |
| STK | Mã giới thiệu | mgi-bank không thu số tài khoản |
| (Phòng) | Trường | |
| Trạng thái | Trạng thái | Nhãn trạng thái của dòng ngân hàng, dùng lại `bankTag` của Trang 3 |
| Xác thực | Xác thực ảnh | x/y của lượt kiểm mới nhất; chỉ hiện khi người xem quản ngân hàng đó |
| Người tạo | Người kiểm | Người bấm Đạt hoặc Không đạt |
| Đã cài app, Thao tác | Bỏ | Đánh dấu Đạt và Không đạt vẫn làm ở Trang 4 |

- Ô tìm: họ tên học sinh hoặc SĐT, cùng luật tìm của Trang 3.
- Bộ lọc (dùng `UrlFilters`, `FilterChips` có sẵn): Ngày (theo ngày tạo hồ sơ), Ngân hàng, Trạng thái, Xác thực ảnh, Trường.
- Sắp xếp: ngày tạo hồ sơ mới nhất lên trước, rồi theo thứ tự chọn ngân hàng của học sinh.
- Phân trang 15 dòng ở máy chủ.
- Xuất Excel (quyền `export_excel`): mỗi dòng ngân hàng một dòng, đúng bộ lọc và phạm vi người xuất, đầu bảng 3 tầng như các file xuất khác, ghi `audit_log`.
- Trang 3 Hồ sơ học sinh: hai cột "Ngân hàng 1", "Ngân hàng 2" gộp thành một cột "Ngân hàng", mỗi ngân hàng một dòng trong ô. File Excel hồ sơ giữ nguyên.

## Task

- [x] **Task 1: Nghiệp vụ danh sách.** `src/server/customerBankList.ts`: hàm danh sách nhận `SessionUser`, bộ lọc, trang. Test DB: học sinh 2 ngân hàng ra 2 dòng; Nhân viên chỉ thấy dòng ngân hàng mình quản và không thấy x/y của ngân hàng khác; từng bộ lọc; ngày tính giờ Việt Nam; phân trang 15.
- [x] **Task 2: Trang và menu.** Trang `/customer-banks`, mục menu, gộp cột ở Trang 3. E2E: học sinh chọn 2 ngân hàng thì trang có 2 dòng của học sinh đó; Nhân viên chỉ thấy dòng ngân hàng mình quản; lọc theo ngân hàng.
- [x] **Task 3: Xuất Excel.** Route `GET /api/admin/customer-banks/export`. Test DB: số dòng, phạm vi, audit.

Cuối kế hoạch chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.

## Kết quả

Làm ngày 2026-11-05, commit `ee2a695`, `96ae8fa`, `3ac71e8` trên `dev`.

- `src/server/customerBankList.ts`: `listCustomerBanks` trả mỗi dòng `customer_banks` một dòng, kèm học sinh, lớp, trường, mã giới thiệu, trạng thái, người kiểm, lượt xác thực ảnh mới nhất. Phạm vi dùng `scopedBankIds` của Trang 3. Ô tìm dùng `customerSearch`, tách từ `customerWhere`.
- `src/lib/customerBankFilters.ts`: bộ lọc trên URL gồm `q`, `from`, `to`, `bank`, `status`, `check`, `school`, `dir`.
- Trang `/customer-banks` và mục menu "Ngân hàng" dưới "Hồ sơ học sinh". Cột Ngày đổi được chiều sắp. Bộ lọc Ngày, Ngân hàng, Trạng thái, Xác thực ảnh, Trường.
- `UrlFilters` nhận thêm ô chọn nhiều (`multiple`) và ô tìm qua route (`kind: "search"`, dùng `MultiSelect`).
- Route `GET /api/admin/customer-banks/schools` cho ô tìm trường: quyền hồ sơ, tối đa 20 dòng, có cả trường đã đóng.
- Route `GET /api/admin/customer-banks/export`: file "ngan-hang-YYYY-MM-DD.xlsx", đầu bảng 3 tầng, nhóm HỌC SINH và NGÂN HÀNG, ghi `audit_log` với `targetType` `customer_banks`.
- Trang 3: cột "Ngân hàng" liệt kê mỗi ngân hàng một dòng trong ô. File Excel hồ sơ giữ nguyên.
- Test mới: `tests/unit/customerBankFilters.test.ts`, `tests/unit/menu.test.ts`, `tests/db/customerBankList.test.ts`, thêm ca ở `tests/db/exports.test.ts` và `tests/db/adminRoutes.test.ts`, `e2e/customerBanks.spec.ts`.
- Đã chạy trên DB tạm `zz_test_bankpage`: `bun run test` 220/220, `bun test:db` 219/219, `bun test:s3` 29/29. `bunx tsc --noEmit` và `bun run lint` đạt.
- Đã xem trang ở 1366x768 bằng bản sao app trỏ DB tạm: Quản trị, Nhân viên quản một ngân hàng, bảng Bộ lọc, ô tìm trường, bảng rỗng, Trang 3.

### Ruling

- Ô Ngân hàng và ô Trường chọn được nhiều giá trị, id ghép dấu phẩy trên URL. mgst-app cho chọn nhiều ngân hàng. Trường là danh sách lớn dần, nên ô Trường dùng `MultiSelect` tìm qua route.
- Ô lọc Ngân hàng ẩn khi người xem chỉ thấy một ngân hàng, như ô Phòng của mgst-app.
- Tham số `dir=asc` đổi chiều sắp theo ngày, như cột Ngày của mgst-app. Mặc định mới nhất trước, rồi theo thứ tự chọn ngân hàng. Thứ tự này khớp Trang 3 sau commit `7a39a0d`.
- Cột Xác thực ảnh hiện trạng thái lượt mới nhất như `PhotoCheckScore` của mgst-app: "Đang kiểm", "Không kiểm được", hoặc x/y có màu theo tỉ lệ đạt và có ký hiệu.
- x/y hiện ở mọi dòng người xem thấy. Phạm vi dòng và `reviewsBank` cùng đọc `customerScope`, nên người xem luôn quản ngân hàng của dòng mình thấy.
- Route tìm trường riêng cho bộ lọc, vì route `/api/admin/schools/options` chỉ trả trường đang mở.
- File Excel có thêm SĐT, phụ huynh, SĐT phụ huynh, kiểm lúc, như file hồ sơ.
- Trang 4 vẫn ghi "Ngân hàng 1", "Ngân hàng 2" ở dòng meta của thẻ ngân hàng. Yêu cầu bỏ chữ này chỉ áp cho Trang 3 và trang mới.

### Việc để lại

- `bun run e2e` chưa chạy: coordinator giữ lượt e2e cho agent khác. `e2e/customerBanks.spec.ts` đã viết, qua `tsc` và `lint`.
- Trang 4 còn chữ "Ngân hàng 1/2" ở dòng meta, nếu chủ dự án muốn bỏ ở mọi nơi.
