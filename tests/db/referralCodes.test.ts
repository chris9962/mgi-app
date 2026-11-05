import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TEST_NAME, cleanTestUsers, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { customerBanks, customers, referralCodeMonths } from "../../src/server/db/schema";
import { loadSessionUser } from "../../src/server/auth/session";
import { createBank } from "../../src/server/banks";
import { createSchool } from "../../src/server/schools";
import { createCode, listCodes, setCodeActive, updateCode } from "../../src/server/referralCodes";
import { BankForm } from "../../src/lib/bankForm";
import { CodeForm } from "../../src/lib/codeForm";
import { SchoolForm } from "../../src/lib/schoolForm";
import { currentYearMonth } from "../../src/lib/month";
import type { SessionUser } from "../../src/lib/types";

const MONTH = currentYearMonth();
let manager: SessionUser;
let staff: SessionUser;
let bankA: string;
let bankB: string;
let schoolId: string;

const codeForm = (bankId: string, name: string, extra: Record<string, unknown> = {}) =>
  CodeForm.parse({ bankId, displayName: TEST_NAME + name, code: "ND-" + name, qrKey: null, openUrl: "", monthlyQuota: "200", priority: "1", schoolIds: [schoolId], ...extra });

beforeAll(async () => {
  await cleanTestUsers();
  manager = await makeActor("code_manager", "manager");
  staff = await makeActor("code_staff", "staff");
  const a = await createBank(manager, BankForm.parse({ code: "ZZCA", name: TEST_NAME + "Bank A", sortOrder: "1", managerIds: [staff.id] }));
  const b = await createBank(manager, BankForm.parse({ code: "ZZCB", name: TEST_NAME + "Bank B", sortOrder: "2", managerIds: [] }));
  const s = await createSchool(manager, SchoolForm.parse({ name: TEST_NAME + "THPT Mã", provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" }));
  if (!a.ok || !b.ok || !s.ok) throw new Error("dựng dữ liệu lỗi");
  [bankA, bankB, schoolId] = [a.id, b.id, s.id];
  staff = (await loadSessionUser(staff.id))!;
});
afterAll(cleanTestUsers);

const find = async (actor: SessionUser, name: string, month = MONTH) => (await listCodes(actor, { month, q: TEST_NAME + name, bankId: "", hideStopped: false, page: 1 })).rows[0];

describe("kho mã giới thiệu", () => {
  test("mã mới: số lượt tháng lấy monthly_quota, chưa dùng lượt nào, còn chỗ", async () => {
    const r = await createCode(manager, codeForm(bankA, "A1"));
    if (!r.ok) throw new Error(r.message);
    const row = await find(manager, "A1");
    expect(row).toMatchObject({ quota: 200, used: 0, passed: 0, holding: 0, failed: 0, status: "open" });
    expect(row.schools.map((x) => x.id)).toEqual([schoolId]);
  });

  test("tên hiển thị trùng trong cùng ngân hàng bị từ chối", async () => {
    expect(await createCode(manager, codeForm(bankA, "A1"))).toMatchObject({ ok: false, field: "displayName" });
  });

  test("thiếu cả mã text và ảnh QR thì form báo lỗi", () => {
    expect(CodeForm.safeParse({ bankId: bankA, displayName: "x", code: "", qrKey: null, openUrl: "", monthlyQuota: "1", priority: "0", schoolIds: [] }).success).toBe(false);
  });

  test("sửa số lượt đổi tháng đang chạy, tháng đã qua giữ nguyên", async () => {
    const r = await createCode(manager, codeForm(bankA, "A2"));
    if (!r.ok) throw new Error(r.message);
    await db.insert(referralCodeMonths).values([
      { referralCodeId: r.id, yearMonth: "2026-01", quota: 50 },
      { referralCodeId: r.id, yearMonth: MONTH, quota: 200 },
    ]);
    expect((await updateCode(manager, r.id, codeForm(bankA, "A2", { monthlyQuota: "300" }))).ok).toBe(true);
    expect((await find(manager, "A2", MONTH)).quota).toBe(300);
    expect((await find(manager, "A2", "2026-01")).quota).toBe(50);
  });

  test("đếm hoàn thành, đang giữ, không đạt theo trạng thái; dùng hết lượt thì hết chỗ", async () => {
    const r = await createCode(manager, codeForm(bankA, "A3", { monthlyQuota: "4" }));
    if (!r.ok) throw new Error(r.message);
    const statuses = ["passed", "pending", "selected", "failed"] as const;
    for (const [i, status] of statuses.entries()) {
      const [c] = await db
        .insert(customers)
        .values({ schoolId, fullName: "HS", nameSearch: "hs", className: "11A1", phone: `09000000${10 + i}`, parentName: "PH", parentPhone: `09100000${10 + i}`, tokenHash: `zz-code-${r.id}-${i}` })
        .returning({ id: customers.id });
      await db.insert(customerBanks).values({ customerId: c.id, bankId: bankA, slot: 1, referralCodeId: r.id, referralCode: "ND-A3", yearMonth: MONTH, status });
    }
    expect(await find(manager, "A3")).toMatchObject({ quota: 4, used: 4, passed: 1, holding: 2, failed: 1, status: "full" });
    expect((await find(manager, "A3", "2026-01")).used).toBe(0);
  });

  test("ngừng mã thì trạng thái Đã ngừng, ẩn khi lọc ẩn mã đã ngừng", async () => {
    const r = await createCode(manager, codeForm(bankA, "A4"));
    if (!r.ok) throw new Error(r.message);
    expect((await setCodeActive(manager, r.id, false)).ok).toBe(true);
    expect((await find(manager, "A4")).status).toBe("stopped");
    const hidden = await listCodes(manager, { month: MONTH, q: TEST_NAME + "A4", bankId: "", hideStopped: true, page: 1 });
    expect(hidden.total).toBe(0);
  });

  test("nhân viên chỉ thấy và tạo mã của ngân hàng mình quản", async () => {
    const b = await createCode(manager, codeForm(bankB, "B1"));
    if (!b.ok) throw new Error(b.message);
    const seen = await listCodes(staff, { month: MONTH, q: TEST_NAME, bankId: "", hideStopped: false, page: 1 });
    expect(seen.rows.every((x) => x.bankId === bankA)).toBe(true);
    expect(seen.rows.length).toBeGreaterThan(0);
    expect((await createCode(staff, codeForm(bankB, "B2"))).ok).toBe(false);
    expect((await updateCode(staff, b.id, codeForm(bankB, "B1"))).ok).toBe(false);
  });
});
