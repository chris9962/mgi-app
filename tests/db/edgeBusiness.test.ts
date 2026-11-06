import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { cleanTestUsers, makeActor } from "./helpers";
import { insertCustomer, setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { reviewEvents, smsMessages, userManagedBanks, vouchers } from "../../src/server/db/schema";
import { loadSessionUser } from "../../src/server/auth/session";
import { listCustomers } from "../../src/server/customerList";
import { listCustomerBanks, readCustomerBankFilters } from "../../src/server/customerBankList";
import { exportCustomerBanks, exportCustomers, exportVouchers } from "../../src/server/exports";
import { reviewCustomerBank } from "../../src/server/review";
import { searchSchoolOptions } from "../../src/server/schools";
import { listSms } from "../../src/server/sms/queue";
import { listVouchers } from "../../src/server/vouchers";
import { parseCustomerFilters } from "../../src/lib/customerFilters";
import { parseSmsFilters } from "../../src/lib/smsFilters";
import { parseVoucherFilters } from "../../src/lib/voucherFilters";
import type { SessionUser } from "../../src/lib/types";

let p: Program;
let admin: SessionUser;
let staff: SessionUser;
const id: Record<string, string> = {};

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("edgeb", ["A", "B"]);
  admin = await makeActor("edgeb_admin", "admin");
  staff = await makeActor("edgeb_staff", "staff", ["vouchers"], [p.bank.A]);
  const anh = await insertCustomer(p, { fullName: "Edgeb Nguyễn Thị Anh", status: "reviewed", createdAt: new Date("2026-11-01T03:00:00Z"), banks: [{ key: "A", status: "passed" }] });
  id.anh = anh.id;
  await db.insert(vouchers).values({ customerId: anh.id, code: "ZZTESTEDGEB-NTA-11A3-AAAA", issuedAt: new Date("2026-11-01T03:00:00Z") });
  await db.insert(smsMessages).values({ customerId: anh.id, kind: "voucher", toPhone: "0988000111", body: "x", status: "failed", attempts: 3, error: "Lỗi" });
  const nam = await insertCustomer(p, { fullName: "Edgeb Lê Hoàng Nam", status: "pending_review", banks: [{ key: "A", status: "pending" }] });
  id.nam = nam.id;
  id.namRow = nam.rows.A;
});
afterAll(cleanTestUsers);

const names = (rows: { fullName: string }[]) => rows.map((r) => r.fullName);

describe("từ khoá có ký tự NUL không làm hỏng câu SQL", () => {
  for (const q of ["\u0000", "edgeb\u0000", "a\u0000b", "0988\u0000000111"])
    test(`từ khoá ${JSON.stringify(q)}`, async () => {
      expect((await listCustomers(admin, parseCustomerFilters({ q }), 1)).page).toBe(1);
      expect((await listCustomerBanks(admin, (await readCustomerBankFilters(admin, { q })).filters, 1)).page).toBe(1);
      expect((await listVouchers(admin, parseVoucherFilters({ q }), 1)).page).toBe(1);
      expect((await listSms(admin, parseSmsFilters({ q, status: "all" }), 1)).page).toBe(1);
      expect(Array.isArray(await searchSchoolOptions(q, { closed: true }))).toBe(true);
      expect((await exportCustomers(admin, parseCustomerFilters({ q }), null)).ok).toBe(true);
      expect((await exportCustomerBanks(admin, (await readCustomerBankFilters(admin, { q })).filters, null)).ok).toBe(true);
      expect((await exportVouchers(admin, parseVoucherFilters({ q }), null)).ok).toBe(true);
    });

  test("NUL bị bỏ, phần còn lại vẫn tìm như thường", async () => {
    expect(names((await listCustomers(admin, parseCustomerFilters({ q: "edgeb\u0000 nam" }), 1)).rows)).toEqual(["Edgeb Lê Hoàng Nam"]);
  });
});

describe("ngày trên URL ngoài khoảng Postgres nhận", () => {
  for (const sp of [{ from: "0001-01-01" }, { to: "0000-01-01" }, { from: "0000-06-15", to: "0001-01-01" }])
    test(`bỏ qua ${JSON.stringify(sp)}, không ném lỗi`, async () => {
      expect(parseCustomerFilters(sp)).toMatchObject({ from: "", to: "" });
      expect((await listCustomers(admin, parseCustomerFilters({ ...sp, q: "edgeb" }), 1)).total).toBe(2);
      expect((await listCustomerBanks(admin, (await readCustomerBankFilters(admin, { ...sp, q: "edgeb" })).filters, 1)).total).toBe(2);
      expect((await listVouchers(admin, parseVoucherFilters({ ...sp, q: "edgeb" }), 1)).total).toBe(1);
    });
});

describe("tìm nhiều từ như mgst-app: mỗi từ một điều kiện, không theo thứ tự", () => {
  test("bỏ từ giữa, đảo thứ tự vẫn ra; một từ không khớp thì không ra", async () => {
    for (const q of ["edgeb nguyen anh", "anh edgeb", "THỊ  edgeb", "Nguyễn Anh Edgeb"]) expect([q, names((await listCustomers(admin, parseCustomerFilters({ q }), 1)).rows)]).toEqual([q, ["Edgeb Nguyễn Thị Anh"]]);
    expect(names((await listCustomers(admin, parseCustomerFilters({ q: "edgeb anh nam" }), 1)).rows)).toEqual([]);
  });

  test("trang Ngân hàng, Mã voucher, Tin SMS lỗi tìm cùng luật", async () => {
    const f = (await readCustomerBankFilters(admin, { q: "anh edgeb" })).filters;
    expect(names((await listCustomerBanks(admin, f, 1)).rows)).toEqual(["Edgeb Nguyễn Thị Anh"]);
    expect(names((await listVouchers(admin, parseVoucherFilters({ q: "anh edgeb" }), 1)).rows)).toEqual(["Edgeb Nguyễn Thị Anh"]);
    expect(names((await listVouchers(admin, parseVoucherFilters({ q: "zztestedgeb-nta" }), 1)).rows)).toEqual(["Edgeb Nguyễn Thị Anh"]);
    expect(names((await listSms(admin, parseSmsFilters({ q: "anh edgeb", status: "all" }), 1)).rows)).toEqual(["Edgeb Nguyễn Thị Anh"]);
  });

  test("cắt ở 8 từ và 100 ký tự: phần thừa không thành điều kiện", async () => {
    const nine = "edgeb nguyen thi anh edgeb nguyen thi anh khongcotrongten";
    expect(names((await listCustomers(admin, parseCustomerFilters({ q: nine }), 1)).rows)).toEqual(["Edgeb Nguyễn Thị Anh"]);
    const long = `edgeb anh${" ".repeat(95)}khongcotrongten`;
    expect(names((await listCustomers(admin, parseCustomerFilters({ q: long }), 1)).rows)).toEqual(["Edgeb Nguyễn Thị Anh"]);
  });
});

describe("Nhân viên đã mở trang rồi bị bỏ giao ngân hàng", () => {
  test("bấm Đạt nhận 404, không ghi lịch sử", async () => {
    await db.delete(userManagedBanks).where(eq(userManagedBanks.userId, staff.id));
    const fresh = (await loadSessionUser(staff.id))!;
    expect(await reviewCustomerBank(fresh, { customerBankId: id.namRow, result: "passed", expected: "pending" }, null)).toMatchObject({ ok: false, status: 404 });
    expect(await db.select().from(reviewEvents).where(eq(reviewEvents.customerBankId, id.namRow))).toEqual([]);
  });
});
