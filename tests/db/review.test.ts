import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { cleanTestUsers, makeActor } from "./helpers";
import { insertCustomer, setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { auditLog, customerBanks, customers, photoChecks, proofPhotos, reviewEvents, smsMessages, vouchers } from "../../src/server/db/schema";
import { replacePhoto, reviewCustomerBank, saveNote, type AdminPhotoStore } from "../../src/server/review";
import { DEFAULT_SMS_TEMPLATE } from "../../src/lib/sms";
import { voucherCode } from "../../src/server/voucher";
import type { SessionUser } from "../../src/lib/types";

let p: Program;
let staffA: SessionUser;
let staffA2: SessionUser;
let staffB: SessionUser;

type Status = "selected" | "pending" | "passed" | "failed";
async function student(a: Status = "pending", b: Status | null = "pending") {
  return insertCustomer(p, {
    fullName: "Review Trần Minh Anh",
    className: "11A3",
    parentPhone: "0987654321",
    status: a === "selected" ? "banks_selected" : "pending_review",
    submittedAt: a === "selected" ? null : new Date(),
    banks: [{ key: "A", status: a }, ...(b ? [{ key: "B", status: b }] : [])],
  });
}

const mark = (actor: SessionUser, customerBankId: string, result: "passed" | "failed", expected: Status = "pending") => reviewCustomerBank(actor, { customerBankId, result, expected }, null);
const rowOf = async (id: string) => (await db.select().from(customerBanks).where(eq(customerBanks.id, id)))[0];
const customerOf = async (id: string) => (await db.select().from(customers).where(eq(customers.id, id)))[0];
const vouchersOf = (id: string) => db.select().from(vouchers).where(eq(vouchers.customerId, id));
const smsOf = (id: string) => db.select().from(smsMessages).where(eq(smsMessages.customerId, id));
const eventsOf = (ids: string[]) => db.select().from(reviewEvents).where(inArray(reviewEvents.customerBankId, ids));

function memoryStore() {
  const objects = new Set<string>();
  const removed: string[] = [];
  const store: AdminPhotoStore = {
    put: async () => {
      const key = `proofs/2026-11-05/${randomUUID()}.webp`;
      objects.add(key);
      return { ok: true, key, size: 1234 };
    },
    remove: async (key) => {
      objects.delete(key);
      removed.push(key);
    },
  };
  return { objects, removed, store };
}

beforeAll(async () => {
  await cleanTestUsers();
  process.env.VOUCHER_SECRET ||= "khoa-test";
  p = await setupProgram("review", ["A", "B"]);
  staffA = await makeActor("review_staff_a", "staff", [], [p.bank.A]);
  staffA2 = await makeActor("review_staff_a2", "staff", [], [p.bank.A]);
  staffB = await makeActor("review_staff_b", "staff", [], [p.bank.B]);
});
afterAll(cleanTestUsers);

describe("đánh dấu", () => {
  test("Đạt đầu tiên: khoá kết quả, ghi lịch sử, cấp voucher, xếp một SMS cho phụ huynh", async () => {
    const c = await student();
    expect(await mark(staffA, c.rows.A, "passed")).toEqual({ ok: true });
    const row = await rowOf(c.rows.A);
    expect([row.status, row.reviewedBy]).toEqual(["passed", staffA.id]);
    expect((await eventsOf([c.rows.A])).map((e) => [e.result, e.previousResult, e.userId])).toEqual([["passed", null, staffA.id]]);
    const cust = await customerOf(c.id);
    expect([cust.status, cust.firstPassedAt !== null]).toEqual(["pending_review", true]);
    const [v] = await vouchersOf(c.id);
    expect(v.code).toMatch(/^ZZTESTTHPTR-RTMA-11A3-[23456789A-HJKMNP-Z]{4}$/);
    const sms = await smsOf(c.id);
    expect(sms.map((s) => [s.kind, s.status, s.toPhone, s.attempts])).toEqual([["voucher", "queued", "0987654321", 0]]);
    expect(sms[0].body).toBe(
      DEFAULT_SMS_TEMPLATE.replace("{HO_TEN}", "REVIEW TRAN MINH ANH")
        .replace("{LOP}", "11A3")
        .replace("{TRUONG}", "ZZTEST THPT review")
        .replace("{NGAN_HANG}", "ZZTEST review A")
        .replace("{MA_VOUCHER}", v.code),
    );
    const [a] = await db.select().from(auditLog).where(and(eq(auditLog.action, "review_customer_bank"), eq(auditLog.targetId, c.rows.A)));
    expect(a.userId).toBe(staffA.id);
  });

  test("hết ngân hàng chờ thì hồ sơ sang Đã kiểm tra; ngân hàng đạt sau không cấp thêm voucher, SMS", async () => {
    const c = await student();
    expect(await mark(staffA, c.rows.A, "passed")).toEqual({ ok: true });
    expect(await mark(staffB, c.rows.B, "passed")).toEqual({ ok: true });
    expect((await customerOf(c.id)).status).toBe("reviewed");
    expect((await vouchersOf(c.id)).length).toBe(1);
    expect((await smsOf(c.id)).length).toBe(1);
  });

  test("Không đạt không cấp voucher; đổi sang Đạt khi chưa có voucher thì cấp như lượt đầu", async () => {
    const c = await student("pending", null);
    expect(await mark(staffA, c.rows.A, "failed")).toEqual({ ok: true });
    expect((await customerOf(c.id)).status).toBe("reviewed");
    expect((await vouchersOf(c.id)).length).toBe(0);
    expect(await mark(staffA2, c.rows.A, "passed", "failed")).toEqual({ ok: true });
    expect((await eventsOf([c.rows.A])).map((e) => [e.result, e.previousResult])).toEqual([
      ["failed", null],
      ["passed", "failed"],
    ]);
    expect((await vouchersOf(c.id)).length).toBe(1);
    expect((await smsOf(c.id)).length).toBe(1);
    expect((await customerOf(c.id)).status).toBe("reviewed");
  });

  test("dòng Đạt bị khoá: không đổi sang Không đạt, không đánh dấu lại", async () => {
    const c = await student();
    await mark(staffA, c.rows.A, "passed");
    expect(await mark(staffA, c.rows.A, "failed", "passed")).toMatchObject({ ok: false, status: 409 });
    expect(await mark(staffA, c.rows.A, "passed", "passed")).toMatchObject({ ok: false, status: 409 });
    expect((await rowOf(c.rows.A)).status).toBe("passed");
  });

  test("trạng thái đã khác lúc người kiểm mở trang thì báo đã có người đánh dấu", async () => {
    const c = await student();
    await mark(staffA, c.rows.A, "failed");
    const r = await mark(staffA2, c.rows.A, "passed", "pending");
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(!r.ok && r.message).toContain("đã có người đánh dấu");
    expect((await rowOf(c.rows.A)).status).toBe("failed");
  });

  test("ngân hàng ngoài phạm vi trả 404; dòng chưa gửi kiểm tra không đánh dấu được", async () => {
    const c = await student();
    expect(await mark(staffB, c.rows.A, "passed")).toMatchObject({ ok: false, status: 404 });
    const draft = await student("selected", null);
    expect(await mark(staffA, draft.rows.A, "passed", "selected")).toMatchObject({ ok: false, status: 409 });
  });

  test("thiếu VOUCHER_SECRET thì từ chối Đạt cấp voucher, không ghi gì; Không đạt vẫn ghi được", async () => {
    const c = await student();
    const secret = process.env.VOUCHER_SECRET;
    delete process.env.VOUCHER_SECRET;
    try {
      expect(await mark(staffA, c.rows.A, "passed")).toMatchObject({ ok: false, status: 500 });
      expect((await rowOf(c.rows.A)).status).toBe("pending");
      expect((await eventsOf([c.rows.A])).length).toBe(0);
      expect((await customerOf(c.id)).firstPassedAt).toBeNull();
      expect(await mark(staffB, c.rows.B, "failed")).toEqual({ ok: true });
    } finally {
      process.env.VOUCHER_SECRET = secret;
    }
  });
});

describe("trùng mã voucher", () => {
  test("mã sinh ra đã có người dùng thì sinh lại theo lượt kế tiếp, vẫn cấp được voucher và SMS", async () => {
    const c = await student();
    const input = { customerId: c.id, provinceCode: "80", wardCode: "25585", parentName: "Phụ Huynh Test", schoolName: p.schoolName, fullName: "Review Trần Minh Anh", className: "11A3" };
    const taken = voucherCode(input, process.env.VOUCHER_SECRET!);
    const other = await student();
    await db.insert(vouchers).values({ customerId: other.id, code: taken });
    expect(await mark(staffA, c.rows.A, "passed")).toEqual({ ok: true });
    const [v] = await vouchersOf(c.id);
    expect(v.code).toBe(voucherCode(input, process.env.VOUCHER_SECRET!, 1));
    expect((await smsOf(c.id))[0].body).toContain(v.code);
    expect((await rowOf(c.rows.A)).status).toBe("passed");
  });
});

describe("đánh dấu cùng lúc", () => {
  test("hai người cùng đánh dấu một dòng: người sau nhận lỗi, chỉ một lịch sử, một voucher, một SMS", async () => {
    const c = await student();
    const results = await Promise.all([mark(staffA, c.rows.A, "passed"), mark(staffA2, c.rows.A, "passed")]);
    expect(results.filter((r) => r.ok).length).toBe(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, status: 409 });
    expect((await eventsOf([c.rows.A])).length).toBe(1);
    expect((await vouchersOf(c.id)).length).toBe(1);
    expect((await smsOf(c.id)).length).toBe(1);
  });

  test("hai người cùng bấm Đạt hai ngân hàng của một học sinh: cả hai ghi được, chỉ một voucher, một SMS", async () => {
    for (let i = 0; i < 5; i++) {
      const c = await student();
      const results = await Promise.all([mark(staffA, c.rows.A, "passed"), mark(staffB, c.rows.B, "passed")]);
      expect(results).toEqual([{ ok: true }, { ok: true }]);
      expect((await vouchersOf(c.id)).length).toBe(1);
      expect((await smsOf(c.id)).length).toBe(1);
      expect((await customerOf(c.id)).status).toBe("reviewed");
    }
  });
});

describe("ghi chú nội bộ", () => {
  test("người quản ngân hàng ghi chú được, ngoài phạm vi trả 404", async () => {
    const c = await student();
    expect(await saveNote(staffA, c.rows.A, "Đã gọi phụ huynh, hẹn mở lại", null)).toEqual({ ok: true });
    expect((await rowOf(c.rows.A)).note).toBe("Đã gọi phụ huynh, hẹn mở lại");
    expect(await saveNote(staffB, c.rows.A, "x", null)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("thay ảnh", () => {
  async function withPhoto(a: Status = "pending") {
    const c = await student(a);
    const [old] = await db.insert(proofPhotos).values({ customerBankId: c.rows.A, slotId: p.slot.A, s3Key: `proofs/2026-11-05/${randomUUID()}.webp`, sizeBytes: 900 }).returning();
    return { c, old };
  }

  test("ảnh cũ ghi replaced_at, ảnh mới có uploaded_by, xếp lại lượt kiểm ảnh, ghi audit", async () => {
    const { c, old } = await withPhoto();
    await db.insert(photoChecks).values({ customerBankId: c.rows.A, status: "pending" });
    const m = memoryStore();
    expect(await replacePhoto(staffA, { customerBankId: c.rows.A, slotId: p.slot.A }, new Uint8Array([1]), null, m.store)).toEqual({ ok: true });
    const photos = await db.select().from(proofPhotos).where(eq(proofPhotos.customerBankId, c.rows.A));
    expect(photos.find((ph) => ph.id === old.id)!.replacedAt).not.toBeNull();
    const current = photos.filter((ph) => ph.replacedAt === null);
    expect(current.map((ph) => [ph.uploadedBy, m.objects.has(ph.s3Key)])).toEqual([[staffA.id, true]]);
    const checks = await db.select().from(photoChecks).where(and(eq(photoChecks.customerBankId, c.rows.A), eq(photoChecks.status, "pending")));
    expect(checks.length).toBe(1);
    const [a] = await db.select().from(auditLog).where(and(eq(auditLog.action, "replace_photo"), eq(auditLog.targetId, c.rows.A)));
    expect(a.userId).toBe(staffA.id);
  });

  test("dòng Không đạt thay ảnh được; dòng Đạt không thay được và object vừa tải bị xoá", async () => {
    const failed = await withPhoto("failed");
    expect(await replacePhoto(staffA, { customerBankId: failed.c.rows.A, slotId: p.slot.A }, new Uint8Array([1]), null, memoryStore().store)).toEqual({ ok: true });
    const passed = await withPhoto("passed");
    const m = memoryStore();
    expect(await replacePhoto(staffA, { customerBankId: passed.c.rows.A, slotId: p.slot.A }, new Uint8Array([1]), null, m.store)).toMatchObject({ ok: false, status: 409 });
    expect(m.objects.size).toBe(0);
    const current = await db.select().from(proofPhotos).where(eq(proofPhotos.customerBankId, passed.c.rows.A));
    expect(current.map((ph) => ph.id)).toEqual([passed.old.id]);
  });

  test("ngân hàng ngoài phạm vi, khung của ngân hàng khác trả 404", async () => {
    const { c } = await withPhoto();
    expect(await replacePhoto(staffB, { customerBankId: c.rows.A, slotId: p.slot.A }, new Uint8Array([1]), null, memoryStore().store)).toMatchObject({ ok: false, status: 404 });
    expect(await replacePhoto(staffA, { customerBankId: c.rows.A, slotId: p.slot.B }, new Uint8Array([1]), null, memoryStore().store)).toMatchObject({ ok: false, status: 404 });
  });
});
