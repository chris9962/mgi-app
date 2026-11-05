import { inArray, like } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import * as s from "../src/server/db/schema";

export const E2E_PREFIX = "zz_e2e_";
export const E2E_NAME = "ZZE2E ";
export const E2E_PASSWORD = "e2e23test";

// Dọn theo thứ tự khoá ngoại: mã, ngân hàng, trường do e2e tạo rồi mới tới tài khoản e2e.
export async function cleanE2e() {
  const banks = (await db.select({ id: s.banks.id }).from(s.banks).where(like(s.banks.name, `${E2E_NAME}%`))).map((r) => r.id);
  const codes = banks.length ? (await db.select({ id: s.referralCodes.id }).from(s.referralCodes).where(inArray(s.referralCodes.bankId, banks))).map((r) => r.id) : [];
  if (codes.length) {
    await db.delete(s.referralCodeSchools).where(inArray(s.referralCodeSchools.referralCodeId, codes));
    await db.delete(s.referralCodeMonths).where(inArray(s.referralCodeMonths.referralCodeId, codes));
    await db.delete(s.referralCodes).where(inArray(s.referralCodes.id, codes));
  }
  if (banks.length) {
    await db.delete(s.userManagedBanks).where(inArray(s.userManagedBanks.bankId, banks));
    await db.delete(s.bankPhotoSlots).where(inArray(s.bankPhotoSlots.bankId, banks));
    await db.delete(s.banks).where(inArray(s.banks.id, banks));
  }
  await db.delete(s.schools).where(like(s.schools.name, `${E2E_NAME}%`));
  const ids = (await db.select({ id: s.users.id }).from(s.users).where(like(s.users.username, `${E2E_PREFIX}%`))).map((r) => r.id);
  if (!ids.length) return;
  await db.delete(s.auditLog).where(inArray(s.auditLog.userId, ids));
  await db.delete(s.users).where(inArray(s.users.id, ids));
}

if (import.meta.main) {
  cleanE2e()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
