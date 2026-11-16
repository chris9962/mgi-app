import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { FAKE_WEBP, TEST_NAME, cleanTestUsers, fakeStore, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { bankPhotoSlots, customerBanks, customers, photoChecks, smsMessages, vouchers } from "../../src/server/db/schema";
import { createBank } from "../../src/server/banks";
import { createSchool } from "../../src/server/schools";
import { createCode } from "../../src/server/referralCodes";
import { createCustomer, reserveBanks, studentState, submitForReview, type Customer } from "../../src/server/customers";
import { cancelBanks, uploadPhoto } from "../../src/server/customerPhotos";
import { BankForm } from "../../src/lib/bankForm";
import { CodeForm } from "../../src/lib/codeForm";
import { CustomerForm } from "../../src/lib/customerForm";
import { SchoolForm } from "../../src/lib/schoolForm";
import type { SessionUser } from "../../src/lib/types";

const MONTH = "2026-11";
let manager: SessionUser;
let schoolId: string;
let phoneSeq = 400;
const bank: Record<string, string> = {};
const slot: Record<string, string> = {};

async function student(): Promise<Customer> {
  phoneSeq += 1;
  const r = await createCustomer(
    CustomerForm.parse({ schoolId, fullName: "Học Sinh Gửi", className: "11A3", phone: `0900000${phoneSeq}`, parentPhone: `0987000${phoneSeq}`, consent: true, existingBankIds: [] }),
    null,
    MONTH,
  );
  if (!r.ok) throw new Error(r.message);
  const fresh = async () => (await db.select().from(customers).where(eq(customers.id, r.id)))[0];
  const res = await reserveBanks(await fresh(), [bank.A, bank.B], MONTH);
  if (!res.ok) throw new Error(res.message);
  return fresh();
}

const rowOf = async (c: Customer, bankKey: string) => (await db.select().from(customerBanks).where(and(eq(customerBanks.customerId, c.id), eq(customerBanks.bankId, bank[bankKey]))))[0];

async function put(c: Customer, bankKey: string, slotKey: string, fake = fakeStore()) {
  const cb = await rowOf(c, bankKey);
  const r = await uploadPhoto(c, { customerBankId: cb.id, slotId: slot[slotKey] }, FAKE_WEBP, fake.store);
  if (!r.ok) throw new Error(r.message);
}

beforeAll(async () => {
  await cleanTestUsers();
  manager = await makeActor("submit_manager", "manager");
  const s = await createSchool(manager, SchoolForm.parse({ name: TEST_NAME + "THPT Gửi", provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" }));
  if (!s.ok) throw new Error(s.message);
  schoolId = s.id;
  for (const [i, k] of ["A", "B"].entries()) {
    const b = await createBank(manager, BankForm.parse({ code: "ZZSU" + k, name: TEST_NAME + "Gửi " + k, sortOrder: String(i), managerIds: [] }));
    if (!b.ok) throw new Error(b.message);
    bank[k] = b.id;
    const c = await createCode(manager, CodeForm.parse({ bankId: b.id, displayName: TEST_NAME + "Gửi " + k, code: "SU-" + k, qrKey: null, openUrl: "", monthlyQuota: "100", priority: "0", schoolIds: [schoolId] }));
    if (!c.ok) throw new Error(c.message);
  }
  const rows = await db
    .insert(bankPhotoSlots)
    .values([
      { bankId: bank.A, name: "A kiểm tên", sortOrder: 0, checkName: true },
      { bankId: bank.A, name: "A không kiểm", sortOrder: 1 },
      { bankId: bank.A, name: "A đã bỏ", sortOrder: 2, removedAt: new Date() },
      { bankId: bank.B, name: "B không kiểm", sortOrder: 0 },
    ])
    .returning({ id: bankPhotoSlots.id });
  [slot.A1, slot.A2, slot.Agone, slot.B1] = rows.map((r) => r.id);
});
afterAll(cleanTestUsers);

describe("Gửi kiểm tra", () => {
  test("còn khung chưa có ảnh thì bị từ chối, không đổi trạng thái", async () => {
    const c = await student();
    await put(c, "A", "A1");
    await put(c, "A", "A2");
    expect(await submitForReview(c)).toMatchObject({ ok: false, status: 400 });
    expect((await db.select().from(customerBanks).where(eq(customerBanks.customerId, c.id))).map((r) => r.status)).toEqual(["selected", "selected"]);
    expect((await db.select({ s: customers.status }).from(customers).where(eq(customers.id, c.id)))[0].s).toBe("banks_selected");
  });

  test("đủ ảnh mọi khung chưa bỏ: dòng ngân hàng sang pending, học sinh sang pending_review, xếp lượt kiểm ảnh cho ngân hàng có khung bật kiểm", async () => {
    const c = await student();
    await put(c, "A", "A1");
    await put(c, "A", "A2");
    await put(c, "B", "B1");
    expect(await submitForReview(c)).toEqual({ ok: true });
    const rows = await db.select().from(customerBanks).where(eq(customerBanks.customerId, c.id)).orderBy(customerBanks.slot);
    expect(rows.map((r) => r.status)).toEqual(["pending", "pending"]);
    expect(rows.every((r) => r.submittedAt instanceof Date)).toBe(true);
    const [row] = await db.select().from(customers).where(eq(customers.id, c.id));
    expect(row.status).toBe("pending_review");
    expect(row.submittedAt).toBeInstanceOf(Date);
    const checks = await db.select().from(photoChecks).where(inArray(photoChecks.customerBankId, rows.map((r) => r.id)));
    expect(checks.map((x) => [x.customerBankId, x.status])).toEqual([[(await rowOf(c, "A")).id, "pending"]]);
  });

  test("sau khi gửi không nộp ảnh, không quay lại, không gửi lại được", async () => {
    const c = await student();
    await put(c, "A", "A1");
    await put(c, "A", "A2");
    await put(c, "B", "B1");
    await submitForReview(c);
    const [locked] = await db.select().from(customers).where(eq(customers.id, c.id));
    const fake = fakeStore();
    const cb = await rowOf(c, "A");
    expect(await uploadPhoto(locked, { customerBankId: cb.id, slotId: slot.A1 }, FAKE_WEBP, fake.store)).toMatchObject({ ok: false, status: 409 });
    expect(fake.objects.size).toBe(0);
    expect(await cancelBanks(locked, fake.store)).toMatchObject({ ok: false, status: 409 });
    expect(await submitForReview(locked)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("Màn kết quả", () => {
  test("chờ kiểm tra: trạng thái từng ngân hàng, thời điểm gửi, SĐT phụ huynh đã che, chưa có voucher", async () => {
    const c = await student();
    await put(c, "A", "A1");
    await put(c, "A", "A2");
    await put(c, "B", "B1");
    await submitForReview(c);
    const [row] = await db.select().from(customers).where(eq(customers.id, c.id));
    const state = await studentState(row, MONTH, fakeStore().store);
    expect(state.banks.map((b) => [b.slot, b.status, b.steps.length, b.slots.length])).toEqual([
      [1, "pending", 0, 0],
      [2, "pending", 0, 0],
    ]);
    expect(state.submittedAt).toBe(row.submittedAt!.toISOString());
    expect(state.parentPhone).toMatch(/^0987 •••• \d{3}$/);
    expect([state.voucher, state.reviewedAt]).toEqual([null, null]);
  });

  test("có voucher: giờ gửi SMS, giờ kiểm tra xong, không trả mã voucher cho học sinh", async () => {
    const c = await student();
    await put(c, "A", "A1");
    await put(c, "A", "A2");
    await put(c, "B", "B1");
    await submitForReview(c);
    const reviewedAt = new Date("2026-11-04T07:05:00Z");
    await db.update(customerBanks).set({ status: "passed", reviewedAt }).where(eq(customerBanks.id, (await rowOf(c, "A")).id));
    await db.update(customerBanks).set({ status: "failed", reviewedAt: new Date("2026-11-04T06:00:00Z") }).where(eq(customerBanks.id, (await rowOf(c, "B")).id));
    await db.update(customers).set({ status: "reviewed", firstPassedAt: reviewedAt }).where(eq(customers.id, c.id));
    await db.insert(vouchers).values({ code: `ZZTEST-${c.id.slice(0, 8)}`, customerId: c.id, issuedAt: reviewedAt });
    await db.insert(smsMessages).values({ customerId: c.id, kind: "voucher", toPhone: "0987000000", body: "x", status: "sent", sentAt: reviewedAt });
    const [row] = await db.select().from(customers).where(eq(customers.id, c.id));
    const state = await studentState(row, MONTH, fakeStore().store);
    expect(state.banks.map((b) => b.status)).toEqual(["passed", "failed"]);
    expect(state.voucher).toEqual({ smsSentAt: reviewedAt.toISOString() });
    expect(JSON.stringify(state)).not.toContain(`ZZTEST-${c.id.slice(0, 8)}`);
    expect(state.reviewedAt).toBe(reviewedAt.toISOString());
  });
});
