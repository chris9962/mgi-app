import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, isNull } from "drizzle-orm";
import { TEST_NAME, cleanTestUsers, fakeStore, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { bankPhotoSlots, customerBanks, customers, proofPhotos } from "../../src/server/db/schema";
import { createBank } from "../../src/server/banks";
import { createSchool } from "../../src/server/schools";
import { createCode } from "../../src/server/referralCodes";
import { createCustomer, reserveBanks, studentState, type Customer } from "../../src/server/customers";
import { cancelBanks, photoUploadUrl, recordPhoto } from "../../src/server/customerPhotos";
import { BankForm } from "../../src/lib/bankForm";
import { CodeForm } from "../../src/lib/codeForm";
import { CustomerForm } from "../../src/lib/customerForm";
import { SchoolForm } from "../../src/lib/schoolForm";
import { isImageKey } from "../../src/lib/imageKey";
import type { SessionUser } from "../../src/lib/types";

const MONTH = "2026-11";
let manager: SessionUser;
let schoolId: string;
let phoneSeq = 300;
const bank: Record<string, string> = {};
const slot: Record<string, string> = {};

async function student(): Promise<Customer> {
  phoneSeq += 1;
  const r = await createCustomer(
    CustomerForm.parse({ schoolId, fullName: "Học Sinh Ảnh", className: "10A1", phone: `0900000${phoneSeq}`, parentName: "Phụ Huynh", parentPhone: `0910000${phoneSeq}`, existingBankIds: [] }),
    null,
    MONTH,
  );
  if (!r.ok) throw new Error(r.message);
  const [row] = await db.select().from(customers).where(eq(customers.id, r.id));
  const res = await reserveBanks(row, [bank.A, bank.B], MONTH);
  if (!res.ok) throw new Error(res.message);
  return (await db.select().from(customers).where(eq(customers.id, r.id)))[0];
}

const rowOf = async (c: Customer, bankKey: string) => (await db.select().from(customerBanks).where(and(eq(customerBanks.customerId, c.id), eq(customerBanks.bankId, bank[bankKey]))))[0];

async function upload(c: Customer, bankKey: string, slotKey: string, fake: ReturnType<typeof fakeStore>, size = 200_000) {
  const cb = await rowOf(c, bankKey);
  const u = await photoUploadUrl(c, { customerBankId: cb.id, slotId: slot[slotKey], contentType: "image/webp" }, fake.store);
  if (!u.ok) throw new Error(u.message);
  fake.objects.set(u.key, size);
  return { cb, key: u.key, result: await recordPhoto(c, { customerBankId: cb.id, slotId: slot[slotKey], key: u.key }, fake.store) };
}

beforeAll(async () => {
  await cleanTestUsers();
  manager = await makeActor("photo_manager", "manager");
  const s = await createSchool(manager, SchoolForm.parse({ name: TEST_NAME + "THPT Ảnh", provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" }));
  if (!s.ok) throw new Error(s.message);
  schoolId = s.id;
  for (const [i, k] of ["A", "B"].entries()) {
    const b = await createBank(manager, BankForm.parse({ code: "ZZPH" + k, name: TEST_NAME + "Ảnh " + k, sortOrder: String(i), managerIds: [] }));
    if (!b.ok) throw new Error(b.message);
    bank[k] = b.id;
    const c = await createCode(manager, CodeForm.parse({ bankId: b.id, displayName: TEST_NAME + "Ảnh " + k, code: "PH-" + k, qrKey: null, openUrl: "", monthlyQuota: "100", priority: "0", schoolIds: [schoolId] }));
    if (!c.ok) throw new Error(c.message);
  }
  const rows = await db
    .insert(bankPhotoSlots)
    .values([
      { bankId: bank.A, name: "Ảnh màn hình chính", sortOrder: 0, checkName: true },
      { bankId: bank.A, name: "Ảnh chuyển khoản", sortOrder: 1 },
      { bankId: bank.A, name: "Khung đã bỏ", sortOrder: 2, removedAt: new Date() },
      { bankId: bank.B, name: "Ảnh B", sortOrder: 0 },
    ])
    .returning({ id: bankPhotoSlots.id });
  [slot.A1, slot.A2, slot.Agone, slot.B1] = rows.map((r) => r.id);
});
afterAll(cleanTestUsers);

describe("xin link tải ảnh", () => {
  test("khung của ngân hàng đã chọn thì cấp link PUT, khoá nằm trong thư mục proofs", async () => {
    const c = await student();
    const fake = fakeStore();
    const u = await photoUploadUrl(c, { customerBankId: (await rowOf(c, "A")).id, slotId: slot.A1, contentType: "image/webp" }, fake.store);
    if (!u.ok) throw new Error(u.message);
    expect(isImageKey(u.key, "proofs")).toBe(true);
    expect(u.key.endsWith(".webp")).toBe(true);
    expect(u.url).toContain(u.key);
  });

  test("khung của ngân hàng khác, khung đã bỏ, dòng của học sinh khác, loại file lạ đều bị từ chối", async () => {
    const [c, other] = [await student(), await student()];
    const fake = fakeStore();
    const cbA = (await rowOf(c, "A")).id;
    expect(await photoUploadUrl(c, { customerBankId: cbA, slotId: slot.B1, contentType: "image/webp" }, fake.store)).toMatchObject({ ok: false, status: 404 });
    expect(await photoUploadUrl(c, { customerBankId: cbA, slotId: slot.Agone, contentType: "image/webp" }, fake.store)).toMatchObject({ ok: false, status: 404 });
    expect(await photoUploadUrl(other, { customerBankId: cbA, slotId: slot.A1, contentType: "image/webp" }, fake.store)).toMatchObject({ ok: false, status: 404 });
    expect(await photoUploadUrl(c, { customerBankId: cbA, slotId: slot.A1, contentType: "text/html" }, fake.store)).toMatchObject({ ok: false, status: 400 });
  });
});

describe("ghi ảnh", () => {
  test("ghi dòng proof_photos với dung lượng đọc từ S3", async () => {
    const c = await student();
    const { cb, key, result } = await upload(c, "A", "A1", fakeStore(), 286_000);
    expect(result.ok).toBe(true);
    const rows = await db.select().from(proofPhotos).where(eq(proofPhotos.customerBankId, cb.id));
    expect(rows.map((r) => [r.slotId, r.s3Key, r.sizeBytes, r.uploadedBy])).toEqual([[slot.A1, key, 286_000, null]]);
  });

  test("ảnh chưa có trên S3 hoặc lớn hơn 10 MB thì không ghi", async () => {
    const c = await student();
    const fake = fakeStore();
    const cb = await rowOf(c, "A");
    const u = await photoUploadUrl(c, { customerBankId: cb.id, slotId: slot.A1, contentType: "image/jpeg" }, fake.store);
    if (!u.ok) throw new Error(u.message);
    expect(await recordPhoto(c, { customerBankId: cb.id, slotId: slot.A1, key: u.key }, fake.store)).toMatchObject({ ok: false, status: 400 });
    const big = await upload(c, "A", "A1", fake, 11 * 1024 * 1024);
    expect(big.result).toMatchObject({ ok: false, status: 400 });
    expect(fake.removed).toContain(big.key);
    expect(await db.select().from(proofPhotos).where(eq(proofPhotos.customerBankId, cb.id))).toEqual([]);
  });

  test("ghi ảnh vào khung của ngân hàng khác bị từ chối, object vừa tải bị xoá", async () => {
    const c = await student();
    const fake = fakeStore();
    const cbA = await rowOf(c, "A");
    const u = await photoUploadUrl(c, { customerBankId: (await rowOf(c, "B")).id, slotId: slot.B1, contentType: "image/webp" }, fake.store);
    if (!u.ok) throw new Error(u.message);
    fake.objects.set(u.key, 1000);
    expect(await recordPhoto(c, { customerBankId: cbA.id, slotId: slot.B1, key: u.key }, fake.store)).toMatchObject({ ok: false, status: 404 });
    expect(await db.select().from(proofPhotos).where(eq(proofPhotos.customerBankId, cbA.id))).toEqual([]);
    expect(fake.removed).toEqual([u.key]);
  });

  test("chụp lại khung đó thì xoá dòng và object cũ, giữ một ảnh cho khung", async () => {
    const c = await student();
    const fake = fakeStore();
    const first = await upload(c, "A", "A1", fake);
    const second = await upload(c, "A", "A1", fake, 150_000);
    expect(second.result.ok).toBe(true);
    const rows = await db.select().from(proofPhotos).where(eq(proofPhotos.customerBankId, first.cb.id));
    expect(rows.map((r) => [r.s3Key, r.sizeBytes])).toEqual([[second.key, 150_000]]);
    expect(fake.removed).toEqual([first.key]);
  });

  test("báo lại cùng một ảnh thì không ghi thêm dòng", async () => {
    const c = await student();
    const fake = fakeStore();
    const { cb, key } = await upload(c, "A", "A1", fake);
    expect((await recordPhoto(c, { customerBankId: cb.id, slotId: slot.A1, key }, fake.store)).ok).toBe(true);
    expect((await db.select().from(proofPhotos).where(eq(proofPhotos.customerBankId, cb.id))).length).toBe(1);
    expect(fake.removed).toEqual([]);
  });

  test("hồ sơ hiện các khung chưa bỏ theo thứ tự, khung đã có ảnh kèm link xem", async () => {
    const c = await student();
    const fake = fakeStore();
    const { key } = await upload(c, "A", "A2", fake, 241_000);
    const state = await studentState(c, MONTH, fake.store);
    expect(state.banks.map((b) => [b.slot, b.bankId, b.referralCode])).toEqual([
      [1, bank.A, "PH-A"],
      [2, bank.B, "PH-B"],
    ]);
    expect(state.banks[0].slots.map((s) => [s.id, s.photo?.sizeBytes ?? null])).toEqual([
      [slot.A1, null],
      [slot.A2, 241_000],
    ]);
    expect(state.banks[0].slots[1].photo?.url).toContain(key);
  });
});

describe("Quay lại chọn ngân hàng", () => {
  test("xoá dòng đã chọn và ảnh, xoá object trên S3, học sinh về new, trả lượt cho mã", async () => {
    const c = await student();
    const fake = fakeStore();
    const a = await upload(c, "A", "A1", fake);
    const b = await upload(c, "B", "B1", fake);
    expect(await cancelBanks(c, fake.store)).toEqual({ ok: true });
    expect(await db.select().from(customerBanks).where(eq(customerBanks.customerId, c.id))).toEqual([]);
    expect(await db.select().from(proofPhotos).where(isNull(proofPhotos.replacedAt)).then((rows) => rows.filter((r) => [a.key, b.key].includes(r.s3Key)))).toEqual([]);
    expect(fake.removed.sort()).toEqual([a.key, b.key].sort());
    const [row] = await db.select().from(customers).where(eq(customers.id, c.id));
    expect(row.status).toBe("new");
    expect((await studentState(row, MONTH, fake.store)).eligibleBanks.map((x) => x.id)).toEqual([bank.A, bank.B]);
    expect((await reserveBanks(row, [bank.B, bank.A], MONTH)).ok).toBe(true);
  });

  test("hồ sơ chưa chọn ngân hàng thì không quay lại được", async () => {
    const c = await student();
    await cancelBanks(c, fakeStore().store);
    const [row] = await db.select().from(customers).where(eq(customers.id, c.id));
    expect(await cancelBanks(row, fakeStore().store)).toMatchObject({ ok: false, status: 409 });
  });
});
