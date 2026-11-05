# Giai đoạn 1: Database và danh mục

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mục tiêu:** DB trống chạy migrate và seed thành công. 23 bảng đúng thiết kế, 34 tỉnh, 3.321 xã, có tài khoản Quản trị đầu tiên.

**Kiến trúc:** Drizzle giữ schema trong một file. `drizzle-kit generate` sinh SQL vào `drizzle/`, `scripts/db-migrate.ts` chạy SQL đó. Script seed chỉ nạp danh mục, migration chỉ chứa cấu trúc.

**Công nghệ:** Postgres 16 trong Docker, `drizzle-orm ^0.45.2`, `drizzle-kit ^0.31.10`, `pg`, `bcryptjs ^3.0.3`, `bun test`.

**Thiết kế gốc:** mục Thiết kế dữ liệu trong `Minh group/Mở tài khoản học sinh qua QR trường.html`. Kế hoạch tổng ở `Minh group/du-an-mo-tai-khoan-hoc-sinh/ke-hoach-trien-khai-2026-11-05.md`.

## Ràng buộc

- Postgres local cổng 5434, database `mgibank`, user `mgibank`. Cổng 5433 đã có mgst-db.
- `DATABASE_URL` thiếu thì script dừng và báo lỗi. Script không được tự dùng `localhost:5432`.
- Id của bảng nghiệp vụ là uuid ngẫu nhiên. `review_events`, `audit_log`, `host_metrics` dùng bigint tự tăng.
- `customers.name_search` do code máy chủ ghi lúc tạo, sửa hồ sơ. Giai đoạn này chỉ tạo cột và chỉ mục.

## Task 1: Công cụ DB

**Files:** `docker-compose.yml`, `.env.example`, `drizzle.config.ts`, `src/server/db/client.ts`, `scripts/db-migrate.ts`, `package.json`

- [ ] Thêm thư viện: `drizzle-orm`, `pg`, `zod`, `bcryptjs`; dev: `drizzle-kit`, `@types/pg`.
- [ ] Thêm lệnh: `db:up`, `db:generate`, `db:migrate`, `db:seed`, `db:create-admin`, `test:db`.
- [ ] Chạy `bun db:up`. Kết quả mong đợi: container `mgi-bank-db` healthy.

## Task 2: Schema 23 bảng

**Files:** `src/server/db/schema.ts`, `drizzle/0000_*.sql`, `tests/db/schema.test.ts`

- [ ] Viết test: database có đúng 23 bảng trong schema `public`, trừ bảng nhật ký của drizzle. Có extension `pg_trgm`.
- [ ] Viết schema đủ cột, enum, khoá ngoại, ràng buộc duy nhất, check và chỉ mục như thiết kế.
- [ ] Chạy `bun db:generate`, thêm `CREATE EXTENSION IF NOT EXISTS pg_trgm;` lên đầu file SQL đầu tiên.
- [ ] Chạy `bun db:migrate` trên DB trống, rồi chạy test. Kết quả mong đợi: PASS.

## Task 3: Seed tỉnh, xã

**Files:** `scripts/data/vnAddress.json` (chép từ mgst-app), `scripts/db-seed.ts`, `tests/db/seed.test.ts`

- [ ] Viết test: `provinces` có 34 dòng, `wards` có 3.321 dòng, xã `25585` là "Xã Châu Thành" thuộc tỉnh `80`. Không tên xã nào chứa ký tự xuống dòng.
- [ ] Viết seed: bảng `provinces` rỗng thì nạp tỉnh và xã trong một transaction, chuẩn hoá khoảng trắng của tên. Chạy lại lần hai không nạp thêm.
- [ ] Chạy seed hai lần rồi chạy test. Kết quả mong đợi: PASS, số dòng không đổi.

## Task 4: Tài khoản Quản trị đầu tiên

**Files:** `scripts/db-create-admin.ts`, `src/server/auth/password.ts`, `tests/auth/password.test.ts`

- [ ] Viết test cho `generatePassword(): string` (12 ký tự, không có 0, O, 1, I, l) và `hashPassword`, `verifyPassword`.
- [ ] Viết script: `bun db:create-admin -- --username admin --full-name "Quản trị"`. Script sinh mật khẩu, lưu băm bcrypt, in mật khẩu một lần. Username đã có thì báo lỗi, không ghi đè.
- [ ] Chạy test và chạy script. Kết quả mong đợi: PASS, bảng `users` có một dòng `role = admin`.
