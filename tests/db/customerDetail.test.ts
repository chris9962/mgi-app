import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { cleanTestUsers, makeActor } from "./helpers";
import { insertCustomer, setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { auditLog, bankPhotoSlots, customerBanks, customers, photoChecks, proofPhotos, vouchers } from "../../src/server/db/schema";
import { getCustomerDetail, photoForView, updateCustomerInfo } from "../../src/server/customerDetail";
import { CustomerEditForm } from "../../src/lib/customerForm";
import type { SessionUser } from "../../src/lib/types";

let p: Program;
let staffA: SessionUser;
let staffNone: SessionUser;

const key = () => `proofs/2026-11-05/${randomUUID()}.webp`;
const edit = (v: Partial<Record<string, string>> = {}) =>
  CustomerEditForm.parse({ fullName: "Detail Trần Minh Anh", className: "11a3", parentPhone: "0987654321", ...v });

async function submitted(fullName = "Detail Trần Minh Anh") {
  const c = await insertCustomer(p, { fullName, parentPhone: "0987654321", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }, { key: "B", status: "pending" }] });
  const [a] = await db.insert(proofPhotos).values({ customerBankId: c.rows.A, slotId: p.slot.A, s3Key: key(), sizeBytes: 1000 }).returning({ id: proofPhotos.id });
  const [b] = await db.insert(proofPhotos).values({ customerBankId: c.rows.B, slotId: p.slot.B, s3Key: key(), sizeBytes: 1000 }).returning({ id: proofPhotos.id });
  return { ...c, photoA: a.id, photoB: b.id };
}

const audits = (photoId: string) => db.select().from(auditLog).where(and(eq(auditLog.action, "view_photo"), eq(auditLog.targetId, photoId)));

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("detail", ["A", "B"]);
  staffA = await makeActor("detail_staff_a", "staff", [], [p.bank.A]);
  staffNone = await makeActor("detail_staff_none", "staff", [], []);
});
afterAll(cleanTestUsers);

describe("chi tiết hồ sơ", () => {
  test("ngoài phạm vi thì như không có", async () => {
    const c = await submitted();
    expect(await getCustomerDetail(staffNone, c.id)).toBeNull();
    expect(await getCustomerDetail(staffA, randomUUID())).toBeNull();
  });

  test("ngân hàng người xem quản có ảnh và ghi chú, ngân hàng khác chỉ có tên và trạng thái", async () => {
    const c = await submitted();
    const d = (await getCustomerDetail(staffA, c.id))!;
    expect(d.banks.map((b) => [b.slot, b.managed, b.status, b.photos.map((ph) => ph.id)])).toEqual([
      [1, true, "pending", [c.photoA]],
      [2, false, "pending", []],
    ]);
    const all = (await getCustomerDetail(p.manager, c.id))!;
    expect(all.banks.map((b) => b.photos.map((ph) => ph.id))).toEqual([[c.photoA], [c.photoB]]);
  });

  test("ngân hàng người xem không quản không trả ghi chú nội bộ và kết quả xác thực ảnh", async () => {
    const c = await submitted();
    await db.update(customerBanks).set({ note: "Ghi chú của ngân hàng B" }).where(eq(customerBanks.id, c.rows.B));
    await db.insert(photoChecks).values({ customerBankId: c.rows.B, status: "done", passed: 0, total: 1, result: [{ slotId: p.slot.B, slotName: "Ảnh B", expected: "Detail Trần Minh Anh", passed: false, reason: "Họ tên" }] });
    const d = (await getCustomerDetail(staffA, c.id))!;
    const other = d.banks.find((b) => b.slot === 2)!;
    expect([other.managed, other.note, other.check, other.slots]).toEqual([false, "", null, []]);
    expect(JSON.stringify(d)).not.toContain("Ghi chú của ngân hàng B");
    const all = (await getCustomerDetail(p.manager, c.id))!;
    expect([all.banks[1].note, all.banks[1].check?.total]).toEqual(["Ghi chú của ngân hàng B", 1]);
  });

  test("hồ sơ trùng cùng tên và SĐT phụ huynh", async () => {
    const first = await submitted("Detail Trùng Tên");
    const second = await submitted("Detail Trùng Tên");
    const d = (await getCustomerDetail(p.manager, second.id))!;
    expect(d.duplicates.map((x) => x.id)).toEqual([first.id]);
  });
});

describe("xem ảnh", () => {
  test("Nhân viên không xem được ảnh ngân hàng khác", async () => {
    const c = await submitted();
    expect(await photoForView(staffA, c.photoB)).toMatchObject({ ok: false, status: 404 });
    expect(await photoForView(staffNone, c.photoA)).toMatchObject({ ok: false, status: 404 });
    expect((await audits(c.photoB)).length).toBe(0);
  });

  test("xem ảnh trả khoá ảnh, không ghi audit (chủ dự án chốt 2026-11-05)", async () => {
    const c = await submitted();
    const r = await photoForView(staffA, c.photoA);
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.key.startsWith("proofs/")).toBe(true);
    await photoForView(p.manager, c.photoA);
    expect((await audits(c.photoA)).length).toBe(0);
  });
});

describe("sửa thông tin", () => {
  test("người quản một ngân hàng của hồ sơ sửa được, ghi lại name_search và audit", async () => {
    const c = await submitted();
    const r = await updateCustomerInfo(staffA, c.id, edit({ fullName: "Detail Lê Thị Đào", className: "12 b1", parentPhone: "0987 000 111" }), null);
    expect(r).toEqual({ ok: true });
    const [row] = await db.select().from(customers).where(eq(customers.id, c.id));
    expect([row.fullName, row.nameSearch, row.className, row.parentPhone]).toEqual(["Detail Lê Thị Đào", "detail le thi dao", "12B1", "0987000111"]);
    const [a] = await db.select().from(auditLog).where(and(eq(auditLog.action, "update_customer"), eq(auditLog.targetId, c.id)));
    expect(a.userId).toBe(staffA.id);
  });

  test("sửa họ tên thì xếp lại lượt kiểm ảnh cho ngân hàng có khung kiểm họ tên", async () => {
    const c = await submitted();
    await db.insert(photoChecks).values({ customerBankId: c.rows.A, status: "pending" });
    await db.update(bankPhotoSlots).set({ checkName: false, checkCode: true }).where(eq(bankPhotoSlots.id, p.slot.B));
    expect(await updateCustomerInfo(staffA, c.id, edit({ fullName: "Detail Tên Mới" }), null)).toEqual({ ok: true });
    const rows = await db.select().from(photoChecks).where(eq(photoChecks.status, "pending"));
    expect(rows.filter((r) => r.customerBankId === c.rows.A).length).toBe(1);
    expect(rows.filter((r) => r.customerBankId === c.rows.B).length).toBe(0);
    await db.update(bankPhotoSlots).set({ checkName: true, checkCode: false }).where(eq(bankPhotoSlots.id, p.slot.B));
  });

  test("hồ sơ đã có voucher thì không sửa được", async () => {
    const c = await submitted();
    await db.insert(vouchers).values({ customerId: c.id, code: `ZZTEST-${randomUUID().slice(0, 8)}` });
    expect(await updateCustomerInfo(staffA, c.id, edit({ fullName: "Detail Không Được" }), null)).toMatchObject({ ok: false, status: 409 });
    expect((await getCustomerDetail(staffA, c.id))!.canEdit).toBe(false);
    const [row] = await db.select().from(customers).where(eq(customers.id, c.id));
    expect(row.fullName).toBe("Detail Trần Minh Anh");
  });

  test("ngoài phạm vi trả 404", async () => {
    const c = await submitted();
    expect(await updateCustomerInfo(staffNone, c.id, edit(), null)).toMatchObject({ ok: false, status: 404 });
  });
});
