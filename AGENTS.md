<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Quy ước dự án mgi-bank

Đọc hết mục này trước khi viết code. Thiết kế nằm ở `../Mở tài khoản học sinh qua QR trường.html`
(file lớn có ảnh base64: grep theo `id="..."` của mục cần đọc, đừng đọc cả file). Các quyết định đã
chốt ở `../du-an-mo-tai-khoan-hoc-sinh/cau-hoi-kien-truc-2026-11-03.md`. Kế hoạch tổng ở
`../du-an-mo-tai-khoan-hoc-sinh/ke-hoach-trien-khai-2026-11-05.md`, kế hoạch từng giai đoạn ở `docs/plans/`.
Mỗi kế hoạch giai đoạn có mục "Việc để lại" của review trước: đọc mục đó.

## Hệ và tên miền

- mgi-bank độc lập với mgst-app (`../mgst-app`). Code của mgst-app chép sang được, không import, không sửa mgst-app.
- Một app Next phục vụ hai tên miền. `src/proxy.ts` rewrite: tên miền quản lý vào `src/app/admin/**`, tên miền học
  sinh vào `src/app/student/**`. API quản lý là `/api/admin/**`, API học sinh là `/api/**` còn lại.
  Local: `http://admin.localhost:3100`, `http://bank.localhost:3100`. Dev server: `bun dev` (cổng 3100).
- Route, bảng, cột ghi `customer`. Chữ trên màn hình ghi "học sinh".
- Máy chủ, Docker, Nginx, sao lưu: đọc `docs/deploy.md` trước khi đụng tới. Không SSH, không deploy khi chủ dự án chưa nói thẳng trong lượt đó.

## Code

- Tên biến, hàm, file, route viết tiếng Anh. Comment và chữ trên màn hình viết tiếng Việt.
- Comment chỉ giải thích TẠI SAO, một dòng, không lặp lại code. Code hiển nhiên thì không comment. Không thêm docstring.
- Nghiệp vụ nằm ở `src/server/*.ts`, nhận `SessionUser` của người thao tác, trả `{ ok: true, ... } | { ok: false, message, status, field? }`.
  Route chỉ parse (zod ở `src/lib/*Form.ts`), gọi nghiệp vụ, trả JSON. Mỗi thao tác ghi ghi `audit_log` qua `writeAudit` trong cùng transaction.
- Quyền: chỉ dùng `src/lib/permissions.ts` (`can`, `canManageBank`, `canManageAnyBank`, `customerScope`). Route gọi
  `requireApi(request, action?)` (đã kiểm Origin chống CSRF). Trang gọi `requirePage` / `requirePageWhere`.
  Kiểm quyền lại ở tầng nghiệp vụ. Bản ghi ngoài phạm vi trả 404, không trả 403.
- Danh sách lớn dần (hồ sơ, trường, mã, voucher, tin SMS) phân trang 15 dòng, tìm, lọc ở máy chủ. Ô chọn tìm qua route riêng, tối đa 20 dòng.
- Câu đếm con trong `sql\`\`` phải ghi rõ tên bảng (ví dụ `sql.raw('"banks"."id"')`): Drizzle in cột của truy vấn một bảng
  không kèm tên bảng, và `"id"` trong câu con trỏ nhầm sang bảng con.
- Form gửi dữ liệu thô lên máy chủ, không gửi bản zod đã transform: máy chủ parse lại bằng cùng schema.
- S3: `src/server/storage.ts`. Bucket local `mgi-bank-dev`, không bao giờ dùng `mgst-images`. Khoá ảnh kiểm bằng `src/lib/imageKey.ts`.
  Không in giá trị khoá S3 trong `.env.local` ra log hay output.
- Tháng tính theo giờ Việt Nam: `src/lib/month.ts`.

## Giao diện

- Tailwind với token trong `src/app/globals.css` (sáng và tối). Không viết mã màu cứng trong component, trừ khối thương hiệu.
- Dùng component có sẵn ở `src/components/ui`: Button, TextField, PasswordField, Select, Combobox, MultiSelect, Checkbox,
  Dialog (native `<dialog>`, ô cần focus đầu tiên gắn `data-autofocus`), Card, StatusTag, Pager, SearchBox, MonthPicker. Hộp xác nhận: `ConfirmDialog`.
- WCAG AA: mọi input có label, nút chỉ có icon có `aria-label`, dùng được bằng bàn phím, không truyền thông tin chỉ bằng màu.
  Test `tests/unit/contrast.test.ts` đo tương phản token.
- React: không dùng `useEffect` cho giá trị suy ra được; xử lý tương tác trong event handler; effect chỉ để đồng bộ hệ ngoài, có cleanup.
- Chữ trên màn hình: không câu giải thích, không xưng "Bạn" (test `tests/unit/copy.test.ts`), hộp xác nhận chỉ một câu hỏi,
  không dấu gạch ngang dài, không dấu chấm giữa. Ngày dạng 05/11/2026, giờ Việt Nam.

## Test và commit

- `bun run test` (unit, không cần DB), `bun test:db` (DB local, dữ liệu test tiền tố `zz_test_` / `ZZTEST `, dọn ở `tests/db/helpers.ts`),
  `bun test:s3` (bucket dev), `bun run e2e` (Playwright, tài khoản `zz_e2e_*`, dữ liệu `ZZE2E `, seed và dọn ở `scripts/e2e-*.ts`),
  `bunx tsc --noEmit`, `bun run lint`. Viết test trước, xem test fail rồi mới code (TDD).
- Không đóng pool trong file test DB: các file chạy chung tiến trình.
- Git: commit trên nhánh `dev`, ký `chuyentina2 <chuyentina2@gmail.com>` (đã cài local). Không merge vào `main`, không push, không deploy.
  Message tiếng Việt, không dấu gạch ngang dài, kết thúc bằng dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Văn xuôi tiếng Việt (docs, commit) viết câu ngắn, chủ động, ngày tuyệt đối YYYY-MM-DD, không ví von.
