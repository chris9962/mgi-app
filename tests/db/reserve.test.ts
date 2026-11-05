import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { TEST_NAME, cleanTestUsers, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { customerBanks, customers, referralCodeMonths } from "../../src/server/db/schema";
import { createBank } from "../../src/server/banks";
import { createSchool } from "../../src/server/schools";
import { createCode } from "../../src/server/referralCodes";
import { createCustomer, reserveBanks, studentState, type Customer } from "../../src/server/customers";
import { BankForm } from "../../src/lib/bankForm";
import { CodeForm } from "../../src/lib/codeForm";
import { CustomerForm } from "../../src/lib/customerForm";
import { SchoolForm } from "../../src/lib/schoolForm";
import type { SessionUser } from "../../src/lib/types";

const MONTH = "2026-11";
let manager: SessionUser;
let phoneSeq = 200;
const bank: Record<string, string> = {};
const code: Record<string, string> = {};
const school: Record<string, string> = {};

const addSchool = async (key: string) => {
  const r = await createSchool(manager, SchoolForm.parse({ name: TEST_NAME + "B2 " + key, provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" }));
  if (!r.ok) throw new Error(r.message);
  school[key] = r.id;
};
const addBank = async (key: string, sortOrder: number) => {
  const r = await createBank(manager, BankForm.parse({ code: "ZZB2" + key, name: TEST_NAME + "B2 " + key, sortOrder: String(sortOrder), managerIds: [] }));
  if (!r.ok) throw new Error(r.message);
  bank[key] = r.id;
};
const addCode = async (key: string, bankKey: string, schoolKey: string, quota: number, priority = 0) => {
  const r = await createCode(manager, CodeForm.parse({ bankId: bank[bankKey], displayName: TEST_NAME + "B2 " + key, code: key, qrKey: null, openUrl: "", monthlyQuota: String(quota), priority: String(priority), schoolIds: [school[schoolKey]] }));
  if (!r.ok) throw new Error(r.message);
  code[key] = r.id;
};

async function student(schoolKey: string, existing: string[] = []): Promise<Customer> {
  phoneSeq += 1;
  const r = await createCustomer(
    CustomerForm.parse({ schoolId: school[schoolKey], fullName: "Học Sinh", className: "10A1", phone: `0900000${phoneSeq}`, parentName: "Phụ Huynh", parentPhone: `0910000${phoneSeq}`, existingBankIds: existing.map((k) => bank[k]) }),
    null,
    MONTH,
  );
  if (!r.ok) throw new Error(r.message);
  const [row] = await db.select().from(customers).where(eq(customers.id, r.id));
  return row;
}

const rowsOf = (customerId: string) => db.select().from(customerBanks).where(eq(customerBanks.customerId, customerId)).orderBy(customerBanks.slot);
const statusOf = async (customerId: string) => (await db.select({ s: customers.status }).from(customers).where(eq(customers.id, customerId)))[0].s;

beforeAll(async () => {
  await cleanTestUsers();
  manager = await makeActor("b2_manager", "manager");
  for (const k of ["S", "RACE", "GONE", "MONTH"]) await addSchool(k);
  for (const [i, k] of ["A", "B", "C", "D", "E", "G", "H"].entries()) await addBank(k, i + 1);
  await addCode("A-LOW", "A", "S", 10, 1);
  await addCode("A-HIGH", "A", "S", 10, 5);
  await addCode("B-1", "B", "S", 10);
  await addCode("C-1", "C", "S", 10);
  await addCode("D-FULL", "D", "S", 1);
  const holder = await student("S", ["A", "B", "C"]);
  await db.insert(customerBanks).values({ customerId: holder.id, bankId: bank.D, slot: 1, referralCodeId: code["D-FULL"], referralCode: "D-FULL", yearMonth: MONTH });
  await addCode("E-RACE", "E", "RACE", 3);
  await addCode("G-GONE", "G", "GONE", 1);
  await addCode("H-MONTH", "H", "MONTH", 1);
});
afterAll(cleanTestUsers);

describe("B2 danh sách đủ điều kiện", () => {
  test("loại ngân hàng đã có và ngân hàng mã hết lượt", async () => {
    const c = await student("S", ["A"]);
    expect((await studentState(c, MONTH)).eligibleBanks.map((b) => b.id)).toEqual([bank.B, bank.C]);
  });

  test("đã có mọi ngân hàng còn lượt thì hồ sơ là no_bank ngay từ B1", async () => {
    expect((await student("S", ["A", "B", "C"])).status).toBe("no_bank");
  });
});

describe("B2 giữ chỗ", () => {
  test("còn từ 2 thì phải chọn đúng 2", async () => {
    const c = await student("S");
    expect(await reserveBanks(c, [bank.A], MONTH)).toMatchObject({ ok: false, field: "bankIds" });
    expect(await reserveBanks(c, [bank.A, bank.B, bank.C], MONTH)).toMatchObject({ ok: false, field: "bankIds" });
    expect(await reserveBanks(c, [bank.A, bank.A], MONTH)).toMatchObject({ ok: false, field: "bankIds" });
    expect(await rowsOf(c.id)).toEqual([]);
  });

  test("chọn trước là vị trí 1; mã ưu tiên cao nhất; chép mã; tạo dòng tháng; học sinh sang banks_selected", async () => {
    const c = await student("S");
    expect(await reserveBanks(c, [bank.C, bank.A], MONTH)).toEqual({ ok: true });
    const rows = await rowsOf(c.id);
    expect(rows.map((r) => [r.slot, r.bankId, r.referralCodeId, r.referralCode, r.yearMonth, r.status])).toEqual([
      [1, bank.C, code["C-1"], "C-1", MONTH, "selected"],
      [2, bank.A, code["A-HIGH"], "A-HIGH", MONTH, "selected"],
    ]);
    const [month] = await db.select().from(referralCodeMonths).where(and(eq(referralCodeMonths.referralCodeId, code["A-HIGH"]), eq(referralCodeMonths.yearMonth, MONTH)));
    expect(month.quota).toBe(10);
    expect(await statusOf(c.id)).toBe("banks_selected");
    expect(await reserveBanks(c, [bank.B, bank.A], MONTH)).toMatchObject({ ok: false, status: 409 });
  });

  test("ngân hàng đã có hoặc mã hết lượt thì không giữ được", async () => {
    const c = await student("S", ["B"]);
    expect(await reserveBanks(c, [bank.A, bank.B], MONTH)).toMatchObject({ ok: false, status: 409 });
    expect(await reserveBanks(c, [bank.A, bank.D], MONTH)).toMatchObject({ ok: false, status: 409 });
    expect(await rowsOf(c.id)).toEqual([]);
  });

  test("còn 1 thì chọn đúng 1, vị trí 1", async () => {
    const c = await student("S", ["A", "B"]);
    expect(await reserveBanks(c, [bank.C, bank.A], MONTH)).toMatchObject({ ok: false });
    expect(await reserveBanks(c, [bank.C], MONTH)).toEqual({ ok: true });
    expect((await rowsOf(c.id)).map((r) => [r.slot, r.bankId])).toEqual([[1, bank.C]]);
  });

  test("mã hết lượt sau khi khai thì hồ sơ sang no_bank, lúc mở web hoặc lúc bấm Tiếp tục", async () => {
    const [waiting, pressing] = [await student("GONE"), await student("GONE")];
    expect(await reserveBanks(await student("GONE"), [bank.G], MONTH)).toEqual({ ok: true });
    expect(await reserveBanks(pressing, [bank.G], MONTH)).toMatchObject({ ok: false, status: 409 });
    expect(await statusOf(pressing.id)).toBe("no_bank");
    const state = await studentState(waiting, MONTH);
    expect([state.customer.status, state.eligibleBanks]).toEqual(["no_bank", []]);
    expect(await statusOf(waiting.id)).toBe("no_bank");
  });

  test("nhiều học sinh giữ chỗ cùng lúc không vượt quota", async () => {
    const list = await Promise.all(Array.from({ length: 6 }, () => student("RACE")));
    const results = await Promise.all(list.map((c) => reserveBanks(c, [bank.E], MONTH)));
    expect(results.filter((r) => r.ok).length).toBe(3);
    expect((await db.select().from(customerBanks).where(eq(customerBanks.referralCodeId, code["E-RACE"]))).length).toBe(3);
  });

  test("giữ chỗ tháng 10, đánh dấu ở tháng 11 vẫn tính lượt tháng 10", async () => {
    const oct = await student("MONTH");
    expect(await reserveBanks(oct, [bank.H], "2026-10")).toEqual({ ok: true });
    await db.update(customerBanks).set({ status: "passed" }).where(eq(customerBanks.customerId, oct.id));
    expect((await rowsOf(oct.id))[0].yearMonth).toBe("2026-10");
    expect(await reserveBanks(await student("MONTH"), [bank.H], "2026-10")).toMatchObject({ ok: false, status: 409 });
    expect(await reserveBanks(await student("MONTH"), [bank.H], "2026-11")).toEqual({ ok: true });
  });

  test("tháng sai dạng thì không ghi", async () => {
    const c = await student("S");
    await expect(reserveBanks(c, [bank.A, bank.B], "2026-13")).rejects.toThrow();
  });
});
