import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { cleanTestUsers, fakeStore, makeActor } from "./helpers";
import { insertCustomer, setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { auditLog, customerBanks, customerExistingBanks, customers, giftClaims, photoChecks, proofPhotos, reviewEvents, smsMessages, vouchers } from "../../src/server/db/schema";
import { deleteCustomer, deleteCustomerBank } from "../../src/server/customerDelete";
import type { SessionUser } from "../../src/lib/types";

let p: Program;
let admin: SessionUser;
let staffA: SessionUser;

const key = () => `proofs/2026-11-05/${randomUUID()}.webp`;

async function full() {
  const c = await insertCustomer(p, { fullName: "Xoá Trần Minh Anh", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "passed" }, { key: "B", status: "pending" }] });
  const keys = [key(), key(), key()];
  await db.insert(proofPhotos).values([
    { customerBankId: c.rows.A, slotId: p.slot.A, s3Key: keys[0], replacedAt: new Date() },
    { customerBankId: c.rows.A, slotId: p.slot.A, s3Key: keys[1] },
    { customerBankId: c.rows.B, slotId: p.slot.B, s3Key: keys[2] },
  ]);
  await db.insert(photoChecks).values({ customerBankId: c.rows.A, status: "done", passed: 1, total: 1 });
  await db.insert(reviewEvents).values({ customerBankId: c.rows.A, userId: p.manager.id, result: "passed" });
  await db.insert(customerExistingBanks).values({ customerId: c.id, bankId: p.bank.C });
  await db.insert(vouchers).values({ customerId: c.id, code: `ZZTEST-${randomUUID().slice(0, 8)}` });
  await db.insert(smsMessages).values({ customerId: c.id, kind: "voucher", toPhone: "0987654321", body: "Ma voucher", status: "sent" });
  await db.insert(giftClaims).values({ customerId: c.id, bankId: p.bank.A, accountNumber: "0123456789", accountName: "TRAN MINH ANH", paidAt: new Date(), paidBy: p.manager.id });
  return { ...c, keys };
}

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("delete", ["A", "B", "C"]);
  admin = await makeActor("delete_admin", "admin");
  staffA = await makeActor("delete_staff_a", "staff", [], [p.bank.A, p.bank.B]);
});
afterAll(cleanTestUsers);

describe("xoá hồ sơ", () => {
  test("Quản lý xoá hồ sơ cùng ngân hàng, ảnh, voucher, SMS, quà; ảnh S3 xoá sau commit; audit giữ thông tin hồ sơ", async () => {
    const c = await full();
    const s = fakeStore();
    expect(await deleteCustomer(p.manager, c.id, null, s.store)).toEqual({ ok: true });
    expect(await db.select().from(customers).where(eq(customers.id, c.id))).toEqual([]);
    expect(await db.select().from(customerBanks).where(eq(customerBanks.customerId, c.id))).toEqual([]);
    expect(await db.select().from(proofPhotos).where(inArray(proofPhotos.s3Key, c.keys))).toEqual([]);
    expect(await db.select().from(reviewEvents).where(inArray(reviewEvents.customerBankId, Object.values(c.rows)))).toEqual([]);
    expect(await db.select().from(vouchers).where(eq(vouchers.customerId, c.id))).toEqual([]);
    expect(await db.select().from(smsMessages).where(eq(smsMessages.customerId, c.id))).toEqual([]);
    expect(await db.select().from(giftClaims).where(eq(giftClaims.customerId, c.id))).toEqual([]);
    expect(await db.select().from(customerExistingBanks).where(eq(customerExistingBanks.customerId, c.id))).toEqual([]);
    expect(s.removed.sort()).toEqual([...c.keys].sort());
    const [a] = await db.select().from(auditLog).where(and(eq(auditLog.action, "delete_customer"), eq(auditLog.targetId, c.id)));
    expect(a.userId).toBe(p.manager.id);
    expect(a.detail).toMatchObject({ fullName: "Xoá Trần Minh Anh", schoolName: p.schoolName });
  });

  test("Quản trị xoá được hồ sơ chưa chọn ngân hàng", async () => {
    const c = await insertCustomer(p, { fullName: "Xoá Hồ Sơ Mới", status: "new" });
    expect(await deleteCustomer(admin, c.id, null, fakeStore().store)).toEqual({ ok: true });
    expect(await db.select().from(customers).where(eq(customers.id, c.id))).toEqual([]);
  });

  test("Nhân viên quản ngân hàng của hồ sơ vẫn không xoá được", async () => {
    const c = await full();
    const s = fakeStore();
    expect(await deleteCustomer(staffA, c.id, null, s.store)).toMatchObject({ ok: false, status: 403 });
    expect((await db.select().from(customers).where(eq(customers.id, c.id))).length).toBe(1);
    expect(s.removed).toEqual([]);
  });

  test("hồ sơ không có trả 404", async () => {
    expect(await deleteCustomer(p.manager, randomUUID(), null, fakeStore().store)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("xoá ngân hàng trong hồ sơ", () => {
  test("Quản lý xoá ngân hàng đã Đạt: xoá ảnh, lượt kiểm ảnh, lịch sử hậu kiểm; ngân hàng khác và voucher giữ nguyên", async () => {
    const c = await full();
    const s = fakeStore();
    expect(await deleteCustomerBank(p.manager, c.rows.A, null, s.store)).toEqual({ ok: true, customerId: c.id });
    expect((await db.select().from(customerBanks).where(eq(customerBanks.customerId, c.id))).map((r) => r.id)).toEqual([c.rows.B]);
    expect(await db.select().from(photoChecks).where(eq(photoChecks.customerBankId, c.rows.A))).toEqual([]);
    expect(await db.select().from(reviewEvents).where(eq(reviewEvents.customerBankId, c.rows.A))).toEqual([]);
    expect(s.removed.sort()).toEqual([c.keys[0], c.keys[1]].sort());
    expect((await db.select().from(vouchers).where(eq(vouchers.customerId, c.id))).length).toBe(1);
    const [a] = await db.select().from(auditLog).where(and(eq(auditLog.action, "delete_customer_bank"), eq(auditLog.targetId, c.rows.A)));
    expect(a.detail).toMatchObject({ customerId: c.id, status: "passed" });
  });

  test("trạng thái hồ sơ tính lại theo các ngân hàng còn lại", async () => {
    const c = await full();
    await deleteCustomerBank(p.manager, c.rows.B, null, fakeStore().store);
    const [after] = await db.select({ status: customers.status }).from(customers).where(eq(customers.id, c.id));
    expect(after.status).toBe("reviewed");
    await deleteCustomerBank(p.manager, c.rows.A, null, fakeStore().store);
    const [none] = await db.select({ status: customers.status }).from(customers).where(eq(customers.id, c.id));
    expect(none.status).toBe("new");
  });

  test("Nhân viên quản ngân hàng đó vẫn không xoá được", async () => {
    const c = await full();
    expect(await deleteCustomerBank(staffA, c.rows.A, null, fakeStore().store)).toMatchObject({ ok: false, status: 403 });
    expect((await db.select().from(customerBanks).where(eq(customerBanks.id, c.rows.A))).length).toBe(1);
  });

  test("dòng không có trả 404", async () => {
    expect(await deleteCustomerBank(p.manager, randomUUID(), null, fakeStore().store)).toMatchObject({ ok: false, status: 404 });
  });
});
