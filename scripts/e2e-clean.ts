import { inArray, like, or } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import * as s from "../src/server/db/schema";
import { deleteImage } from "../src/server/storage";

export const E2E_PREFIX = "zz_e2e_";
export const E2E_NAME = "ZZE2E ";
export const E2E_PASSWORD = "e2e23test";

// Dọn theo thứ tự khoá ngoại: mã, ngân hàng, trường do e2e tạo rồi mới tới tài khoản e2e.
export async function cleanE2e() {
  const banks = (await db.select({ id: s.banks.id }).from(s.banks).where(like(s.banks.name, `${E2E_NAME}%`))).map((r) => r.id);
  const users = (await db.select({ id: s.users.id }).from(s.users).where(like(s.users.username, `${E2E_PREFIX}%`))).map((r) => r.id);
  // Mã do e2e tạo có thể nằm ở ngân hàng không phải của e2e, nên dọn cả theo tên và theo người tạo.
  const codes = (
    await db
      .select({ id: s.referralCodes.id })
      .from(s.referralCodes)
      .where(
        or(
          like(s.referralCodes.displayName, `${E2E_NAME}%`),
          banks.length ? inArray(s.referralCodes.bankId, banks) : undefined,
          users.length ? inArray(s.referralCodes.createdBy, users) : undefined,
        ),
      )
  ).map((r) => r.id);
  const schools = (await db.select({ id: s.schools.id }).from(s.schools).where(like(s.schools.name, `${E2E_NAME}%`))).map((r) => r.id);
  const customers = schools.length ? (await db.select({ id: s.customers.id }).from(s.customers).where(inArray(s.customers.schoolId, schools))).map((r) => r.id) : [];
  const customerBanks = (
    await db
      .select({ id: s.customerBanks.id })
      .from(s.customerBanks)
      .where(or(customers.length ? inArray(s.customerBanks.customerId, customers) : undefined, codes.length ? inArray(s.customerBanks.referralCodeId, codes) : undefined))
  ).map((r) => r.id);
  // Ảnh học sinh và ảnh mẫu do e2e tải lên nằm trên bucket dev: đọc khoá trước khi xoá dòng.
  const keys = [
    ...(customerBanks.length ? await db.select({ key: s.proofPhotos.s3Key }).from(s.proofPhotos).where(inArray(s.proofPhotos.customerBankId, customerBanks)) : []),
    ...(banks.length ? await db.select({ key: s.bankPhotoSlots.sampleKey }).from(s.bankPhotoSlots).where(inArray(s.bankPhotoSlots.bankId, banks)).then((rows) => rows.filter((r) => r.key)) : []),
  ].map((r) => r.key!);
  if (customers.length) {
    await db.delete(s.customerExistingBanks).where(inArray(s.customerExistingBanks.customerId, customers));
    await db.delete(s.smsMessages).where(inArray(s.smsMessages.customerId, customers));
    await db.delete(s.vouchers).where(inArray(s.vouchers.customerId, customers));
  }
  if (customerBanks.length) await db.delete(s.customerBanks).where(inArray(s.customerBanks.id, customerBanks));
  if (customers.length) await db.delete(s.customers).where(inArray(s.customers.id, customers));
  for (const key of keys) await deleteImage(key).catch((e) => console.error("Không xoá được ảnh e2e trên S3:", key, e instanceof Error ? e.message : e));
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
  if (!users.length) return;
  await db.delete(s.auditLog).where(inArray(s.auditLog.userId, users));
  await db.delete(s.users).where(inArray(s.users.id, users));
}

if (import.meta.main) {
  cleanE2e()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
