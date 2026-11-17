import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { count, eq, inArray, like } from "drizzle-orm";
import { db } from "../../src/server/db/client";
import { bankPhotoSlots, banks, customerBanks, customers, proofPhotos, referralCodes, schools, settings, users } from "../../src/server/db/schema";
import { hashToken, loadSessionUser } from "../../src/server/auth/session";
import { getSettings, saveSettings } from "../../src/server/settings";
import { DEFAULT_PVI_APP_URL, DEFAULT_SMS_TEMPLATE } from "../../src/lib/sms";
import { cleanTestUsers, makeActor } from "./helpers";
import { newKey } from "../../src/server/storage";
import { cleanE2e, E2E_NAME, E2E_PREFIX } from "../../scripts/e2e-clean";

const e2eRows = async () => ({
  schools: (await db.select({ n: count() }).from(schools).where(like(schools.name, `${E2E_NAME}%`)))[0].n,
  banks: (await db.select({ n: count() }).from(banks).where(like(banks.name, `${E2E_NAME}%`)))[0].n,
  codes: (await db.select({ n: count() }).from(referralCodes).where(like(referralCodes.displayName, `${E2E_NAME}%`)))[0].n,
  users: (await db.select({ n: count() }).from(users).where(like(users.username, `${E2E_PREFIX}%`)))[0].n,
});

// Hồ sơ cố ý không mang tiền tố test: cleanE2e phải để yên hồ sơ thật.
async function realProfile() {
  const tag = randomUUID().slice(0, 8);
  const ids = { key: newKey("proofs", "webp"), school: "", bank: "", code: "", slot: "", customer: "", customerBank: "", photo: "" };
  [{ id: ids.school }] = await db.insert(schools).values({ name: `Kiểm Dọn THPT ${tag}`, wardCode: "25585", contactName: "A", contactPhone: "0903111222" }).returning({ id: schools.id });
  [{ id: ids.bank }] = await db.insert(banks).values({ code: `KD${tag}`, name: `Kiểm Dọn ${tag}` }).returning({ id: banks.id });
  [{ id: ids.code }] = await db.insert(referralCodes).values({ bankId: ids.bank, displayName: `Kiểm Dọn ${tag}`, code: `KD-${tag}`, monthlyQuota: 10 }).returning({ id: referralCodes.id });
  [{ id: ids.slot }] = await db.insert(bankPhotoSlots).values({ bankId: ids.bank, name: "Ảnh" }).returning({ id: bankPhotoSlots.id });
  [{ id: ids.customer }] = await db
    .insert(customers)
    .values({ schoolId: ids.school, fullName: "Kiểm Dọn", nameSearch: "kiem don", className: "10A1", parentPhone: "0910000999", status: "banks_selected", tokenHash: hashToken(randomUUID()) })
    .returning({ id: customers.id });
  [{ id: ids.customerBank }] = await db
    .insert(customerBanks)
    .values({ customerId: ids.customer, bankId: ids.bank, slot: 1, referralCodeId: ids.code, referralCode: `KD-${tag}`, yearMonth: "2026-11", status: "selected" })
    .returning({ id: customerBanks.id });
  [{ id: ids.photo }] = await db.insert(proofPhotos).values({ customerBankId: ids.customerBank, slotId: ids.slot, s3Key: ids.key, sizeBytes: 1 }).returning({ id: proofPhotos.id });
  return ids;
}

// Chỉ dọn được hồ sơ đã dựng xong: realProfile lỗi giữa chừng thì ids còn rỗng, phần đã tạo nằm lại trong DB.
async function removeProfile(ids: Partial<Awaited<ReturnType<typeof realProfile>>>) {
  if (ids.customerBank) await db.delete(customerBanks).where(eq(customerBanks.id, ids.customerBank));
  if (ids.customer) await db.delete(customers).where(eq(customers.id, ids.customer));
  if (ids.slot) await db.delete(bankPhotoSlots).where(eq(bankPhotoSlots.id, ids.slot));
  if (ids.code) await db.delete(referralCodes).where(eq(referralCodes.id, ids.code));
  if (ids.bank) await db.delete(banks).where(eq(banks.id, ids.bank));
  if (ids.school) await db.delete(schools).where(eq(schools.id, ids.school));
}

describe("scripts/e2e-clean.ts", () => {
  test("không có dữ liệu e2e thì không xoá dòng ngân hàng và ảnh của hồ sơ thật", async () => {
    // Có dữ liệu e2e thì câu chọn có điều kiện và test đạt cả khi lỗi còn; cleanE2e còn xoá thật dữ liệu của lượt e2e đang chạy.
    expect(await e2eRows()).toEqual({ schools: 0, banks: 0, codes: 0, users: 0 });
    let ids: Partial<Awaited<ReturnType<typeof realProfile>>> = {};
    try {
      ids = await realProfile();
      await cleanE2e();
      expect((await db.select({ id: customerBanks.id }).from(customerBanks).where(eq(customerBanks.id, ids.customerBank!))).length).toBe(1);
      expect((await db.select({ key: proofPhotos.s3Key }).from(proofPhotos).where(eq(proofPhotos.id, ids.photo!))).map((r) => r.key)).toEqual([ids.key!]);
    } finally {
      await removeProfile(ids);
    }
  });

  test("cài đặt do tài khoản e2e lưu trở lại như trước lượt e2e: dòng mặc định thì xoá, dòng riêng thì giữ giá trị cũ", async () => {
    expect(await e2eRows()).toEqual({ schools: 0, banks: 0, codes: 0, users: 0 });
    const keys = ["sms_template", "zalo_url", "pvi_app_url"];
    const saved = await db.select().from(settings).where(inArray(settings.key, keys));
    await db.delete(settings).where(inArray(settings.key, keys));
    try {
      const owner = await makeActor("clean_owner", "admin");
      const own = { smsTemplate: DEFAULT_SMS_TEMPLATE, zaloUrl: "https://zalo.me/0911000111", pviAppUrl: DEFAULT_PVI_APP_URL };
      expect((await saveSettings(owner, own)).ok).toBe(true);
      const [row] = await db.insert(users).values({ username: `${E2E_PREFIX}settings`, fullName: "E2E Cài đặt", passwordHash: "x", role: "admin" }).returning({ id: users.id });
      const e2e = (await loadSessionUser(row.id))!;
      expect((await saveSettings(e2e, { smsTemplate: "ZZE2E {HO_TEN} {MA_VOUCHER}", zaloUrl: "https://zalo.me/0900000001", pviAppUrl: "https://pvi.example/e2e" })).ok).toBe(true);
      expect((await saveSettings(e2e, { smsTemplate: "ZZE2E lan hai {MA_VOUCHER}", zaloUrl: "https://zalo.me/0900000002", pviAppUrl: "https://pvi.example/e2e2" })).ok).toBe(true);

      await cleanE2e();

      expect(await getSettings()).toEqual(own);
      expect((await db.select({ key: settings.key, updatedBy: settings.updatedBy }).from(settings).where(inArray(settings.key, keys))).sort((a, b) => a.key.localeCompare(b.key))).toEqual([{ key: "zalo_url", updatedBy: null }]);
      expect((await e2eRows()).users).toBe(0);
    } finally {
      await db.delete(settings).where(inArray(settings.key, keys));
      if (saved.length) await db.insert(settings).values(saved);
      await cleanTestUsers();
    }
  });
});
