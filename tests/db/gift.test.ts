import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { insertCustomer, setupProgram, type Program } from "./fixtures";
import { cleanTestUsers, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { auditLog, customers, giftClaims } from "../../src/server/db/schema";
import { claimGift, giftDetail, giftState, markGiftPaid } from "../../src/server/gift";
import { GiftForm } from "../../src/lib/giftForm";
import type { SessionUser } from "../../src/lib/types";

let p: Program;
let voucherStaff: SessionUser;
let plainStaff: SessionUser;

const customerOf = async (id: string) => (await db.select().from(customers).where(eq(customers.id, id)))[0];
const form = (bankId: string, extra: Record<string, unknown> = {}) => GiftForm.parse({ bankId, accountNumber: "0123 456 789", accountName: "  Trần   Minh Anh ", ...extra });

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("gift", ["A", "B"]);
  voucherStaff = await makeActor("gift_voucher", "staff", ["vouchers"]);
  plainStaff = await makeActor("gift_plain", "staff");
});
afterAll(cleanTestUsers);

describe("quà 20.000 đồng từ ngân hàng thứ hai", () => {
  test("form: số tài khoản bỏ dấu cách và dấu chấm, 6 tới 20 chữ số; tên gọn khoảng trắng", () => {
    expect(form(p.bank.A)).toMatchObject({ accountNumber: "0123456789", accountName: "Trần Minh Anh" });
    expect(GiftForm.safeParse({ bankId: p.bank.A, accountNumber: "12345", accountName: "A" }).success).toBe(false);
    expect(GiftForm.safeParse({ bankId: p.bank.A, accountNumber: "12a456", accountName: "A" }).success).toBe(false);
    expect(GiftForm.safeParse({ bankId: "x", accountNumber: "123456", accountName: "A" }).success).toBe(false);
  });

  test("mới gửi 1 ngân hàng thì chưa đủ điều kiện; gửi 2 thì khai được, chỉ vào ngân hàng đã gửi, khai một lần", async () => {
    const one = await insertCustomer(p, { fullName: "Gift Một", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }, { key: "B", status: "selected" }] });
    expect(await giftState(one.id)).toEqual({ eligible: false, banks: [{ id: p.bank.A, name: expect.any(String) }], claim: null });
    expect(await claimGift(await customerOf(one.id), form(p.bank.A))).toMatchObject({ ok: false, status: 409 });

    const two = await insertCustomer(p, { fullName: "Gift Hai", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }, { key: "B", status: "passed" }] });
    const c = await customerOf(two.id);
    expect((await giftState(two.id)).eligible).toBe(true);
    const outsider = (await setupProgram("gift2", ["C"])).bank.C;
    expect(await claimGift(c, form(outsider))).toMatchObject({ ok: false, status: 400, field: "bankId" });
    expect(await claimGift(c, form(p.bank.B))).toEqual({ ok: true });
    expect(await claimGift(c, form(p.bank.A))).toMatchObject({ ok: false, status: 409 });
    const state = await giftState(two.id);
    expect(state.claim).toMatchObject({ accountNumber: "0123456789", accountName: "Trần Minh Anh", paidAt: null });
    expect(state.claim?.bankName).toBe(state.banks.find((b) => b.id === p.bank.B)!.name);
  });

  test("đánh dấu đã chuyển: cần quyền Quản lý voucher, chưa khai thì 404, hai lần thì 409, ghi audit", async () => {
    const two = await insertCustomer(p, { fullName: "Gift Trả", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }, { key: "B", status: "pending" }] });
    expect(await markGiftPaid(voucherStaff, two.id, null)).toMatchObject({ ok: false, status: 404 });
    await claimGift(await customerOf(two.id), form(p.bank.A));
    expect(await markGiftPaid(plainStaff, two.id, null)).toMatchObject({ ok: false, status: 403 });
    expect(await markGiftPaid(voucherStaff, two.id, null)).toEqual({ ok: true });
    expect(await markGiftPaid(voucherStaff, two.id, null)).toMatchObject({ ok: false, status: 409 });
    const detail = await giftDetail(two.id);
    expect(detail.claim?.paidBy).toBe(voucherStaff.fullName);
    expect(detail.claim?.paidAt).toBeInstanceOf(Date);
    expect((await db.select().from(auditLog).where(and(eq(auditLog.userId, voucherStaff.id), eq(auditLog.action, "pay_gift")))).length).toBe(1);
    const [row] = await db.select().from(giftClaims).where(eq(giftClaims.customerId, two.id));
    expect(row.paidBy).toBe(voucherStaff.id);
  });
});
