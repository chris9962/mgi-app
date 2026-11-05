import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db, pool } from "../src/server/db/client";
import { bankPhotoSlots, banks, referralCodeSchools, referralCodes, schools, userManagedBanks, userPermissions, users } from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/password";
import { putImage } from "../src/server/storage";
import { cleanE2e, E2E_NAME, E2E_PASSWORD, E2E_PREFIX } from "./e2e-clean";
import { E2E_REVIEW_BANK, E2E_STUDENT_SCHOOL, E2E_STUDENT_SCHOOL_ID } from "./e2e-data";

// Web học sinh cần sẵn một trường có 3 ngân hàng mở, mỗi ngân hàng có hướng dẫn, khung ảnh và mã gắn cho trường.
async function seedStudentWeb(adminId: string): Promise<Record<string, string>> {
  const sample = await putImage(new Uint8Array(readFileSync(join(import.meta.dir, "../public/brand/photo.jpg"))), "samples");
  if (!sample.ok) throw new Error(sample.message);
  await db.insert(schools).values({ id: E2E_STUDENT_SCHOOL_ID, name: E2E_STUDENT_SCHOOL, wardCode: "25585", contactName: "E2E", contactPhone: "0903111222", createdBy: adminId });
  const list = [
    { key: "MB", slots: ["Ảnh màn hình chính"], openUrl: null },
    { key: "VPBank", slots: ["Ảnh màn hình chính", "Ảnh chuyển khoản"], openUrl: "https://example.com/mo-tai-khoan" },
    { key: "TPBank", slots: ["Ảnh màn hình chính"], openUrl: null },
  ];
  const ids: Record<string, string> = {};
  for (const [i, b] of list.entries()) {
    const [bank] = await db
      .insert(banks)
      .values({ code: `ZZE2EH${i + 1}`, name: `${E2E_NAME}HS ${b.key}`, sortOrder: 90 + i, guide: [`Tải app ${b.key}.`, "Chọn Mở tài khoản, chụp CCCD và khuôn mặt.", "Nhập mã giới thiệu bên dưới."] })
      .returning({ id: banks.id });
    await db.insert(bankPhotoSlots).values(b.slots.map((name, n) => ({ bankId: bank.id, name, sortOrder: n, checkName: n === 0, checkCode: n === 0, sampleKey: n === 0 ? sample.key : null })));
    const [code] = await db
      .insert(referralCodes)
      .values({ bankId: bank.id, displayName: `${E2E_NAME}HS ${b.key}`, code: `HS-${b.key.toUpperCase()}-01`, openUrl: b.openUrl, monthlyQuota: 100, createdBy: adminId })
      .returning({ id: referralCodes.id });
    await db.insert(referralCodeSchools).values({ referralCodeId: code.id, schoolId: E2E_STUDENT_SCHOOL_ID });
    ids[`${E2E_NAME}HS ${b.key}`] = bank.id;
  }
  return ids;
}

// Tài khoản test mang tiền tố zz_e2e_ để script dọn xoá được kể cả khi test hỏng giữa chừng. Chỉ chạy trên DB local.
async function main() {
  await cleanE2e();
  const passwordHash = await hashPassword(E2E_PASSWORD);
  const [admin] = await db
    .insert(users)
    .values([
      { username: `${E2E_PREFIX}admin`, fullName: "E2E Quản trị", role: "admin", passwordHash },
      { username: `${E2E_PREFIX}staff`, fullName: "E2E Nhân viên", role: "staff", passwordHash },
      { username: `${E2E_PREFIX}lock`, fullName: "E2E Khoá", role: "staff", passwordHash },
    ])
    .returning({ id: users.id });
  const bankIds = await seedStudentWeb(admin.id);
  // Người hậu kiểm chỉ quản một ngân hàng của trường e2e, có quyền xem mã voucher.
  const [reviewer] = await db.insert(users).values({ username: `${E2E_PREFIX}reviewer`, fullName: "E2E Hậu kiểm", role: "staff", passwordHash }).returning({ id: users.id });
  await db.insert(userManagedBanks).values({ userId: reviewer.id, bankId: bankIds[E2E_REVIEW_BANK] });
  await db.insert(userPermissions).values({ userId: reviewer.id, permission: "vouchers" });
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
