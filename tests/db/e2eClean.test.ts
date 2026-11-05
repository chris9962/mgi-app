import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../src/server/db/client";
import { bankPhotoSlots, banks, customerBanks, customers, proofPhotos, referralCodes, schools } from "../../src/server/db/schema";
import { hashToken } from "../../src/server/auth/session";
import { newKey } from "../../src/server/storage";
import { cleanE2e } from "../../scripts/e2e-clean";

// Dữ liệu cố ý không mang tiền tố test: cleanE2e phải để yên hồ sơ thật. Test chỉ xoá đúng các dòng nó tạo.
const tag = randomUUID().slice(0, 8);
const key = newKey("proofs", "webp");
const ids = { school: "", bank: "", code: "", customer: "", customerBank: "", slot: "", photo: "" };

beforeAll(async () => {
  [{ id: ids.school }] = await db.insert(schools).values({ name: `Kiểm Dọn THPT ${tag}`, wardCode: "25585", contactName: "A", contactPhone: "0903111222" }).returning({ id: schools.id });
  [{ id: ids.bank }] = await db.insert(banks).values({ code: `KD${tag}`, name: `Kiểm Dọn ${tag}` }).returning({ id: banks.id });
  [{ id: ids.code }] = await db.insert(referralCodes).values({ bankId: ids.bank, displayName: `Kiểm Dọn ${tag}`, code: `KD-${tag}`, monthlyQuota: 10 }).returning({ id: referralCodes.id });
  [{ id: ids.slot }] = await db.insert(bankPhotoSlots).values({ bankId: ids.bank, name: "Ảnh" }).returning({ id: bankPhotoSlots.id });
  [{ id: ids.customer }] = await db
    .insert(customers)
    .values({ schoolId: ids.school, fullName: "Kiểm Dọn", nameSearch: "kiem don", className: "10A1", phone: "0900000999", parentName: "B", parentPhone: "0910000999", status: "banks_selected", tokenHash: hashToken(randomUUID()) })
    .returning({ id: customers.id });
  [{ id: ids.customerBank }] = await db
    .insert(customerBanks)
    .values({ customerId: ids.customer, bankId: ids.bank, slot: 1, referralCodeId: ids.code, referralCode: `KD-${tag}`, yearMonth: "2026-11", status: "selected" })
    .returning({ id: customerBanks.id });
  [{ id: ids.photo }] = await db.insert(proofPhotos).values({ customerBankId: ids.customerBank, slotId: ids.slot, s3Key: key, sizeBytes: 1 }).returning({ id: proofPhotos.id });
});

afterAll(async () => {
  await db.delete(proofPhotos).where(eq(proofPhotos.id, ids.photo));
  await db.delete(customerBanks).where(eq(customerBanks.id, ids.customerBank));
  await db.delete(customers).where(eq(customers.id, ids.customer));
  await db.delete(bankPhotoSlots).where(eq(bankPhotoSlots.id, ids.slot));
  await db.delete(referralCodes).where(eq(referralCodes.id, ids.code));
  await db.delete(banks).where(inArray(banks.id, [ids.bank]));
  await db.delete(schools).where(eq(schools.id, ids.school));
});

describe("scripts/e2e-clean.ts", () => {
  test("không có dữ liệu e2e thì không xoá dòng ngân hàng và ảnh của hồ sơ thật", async () => {
    await cleanE2e();
    expect((await db.select({ id: customerBanks.id }).from(customerBanks).where(eq(customerBanks.id, ids.customerBank))).length).toBe(1);
    expect((await db.select({ key: proofPhotos.s3Key }).from(proofPhotos).where(eq(proofPhotos.id, ids.photo))).map((r) => r.key)).toEqual([key]);
  });
});
