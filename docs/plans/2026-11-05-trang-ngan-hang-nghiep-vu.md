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

- [ ] **Task 1: Nghiệp vụ danh sách.** `src/server/customerBankList.ts`: hàm danh sách nhận `SessionUser`, bộ lọc, trang. Test DB: học sinh 2 ngân hàng ra 2 dòng; Nhân viên chỉ thấy dòng ngân hàng mình quản và không thấy x/y của ngân hàng khác; từng bộ lọc; ngày tính giờ Việt Nam; phân trang 15.
- [ ] **Task 2: Trang và menu.** Trang `/customer-banks`, mục menu, gộp cột ở Trang 3. E2E: học sinh chọn 2 ngân hàng thì trang có 2 dòng của học sinh đó; Nhân viên chỉ thấy dòng ngân hàng mình quản; lọc theo ngân hàng.
- [ ] **Task 3: Xuất Excel.** Route `GET /api/admin/customer-banks/export`. Test DB: số dòng, phạm vi, audit.

Cuối kế hoạch chạy đủ: `bun run test`, `bun test:db`, `bun test:s3`, `bun run e2e`, `bunx tsc --noEmit`, `bun run lint`.
