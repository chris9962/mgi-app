import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cleanTestUsers, makeActor } from "./helpers";
import { insertCustomer, setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { vouchers } from "../../src/server/db/schema";
import { listVouchers, PAGE_SIZE } from "../../src/server/vouchers";
import { parseVoucherFilters } from "../../src/lib/voucherFilters";
import type { SessionUser } from "../../src/lib/types";

let p: Program;
let holder: SessionUser;
let other: SessionUser;

const list = (actor: SessionUser, sp: Record<string, string>, page = 1) => listVouchers(actor, parseVoucherFilters(sp), page);
const codes = async (actor: SessionUser, sp: Record<string, string>) => (await list(actor, sp)).rows.map((r) => r.code);

async function issue(fullName: string, code: string, issuedAt: Date) {
  const c = await insertCustomer(p, { fullName, status: "reviewed", submittedAt: issuedAt, banks: [{ key: "A", status: "passed" }] });
  await db.insert(vouchers).values({ customerId: c.id, code, issuedAt });
}

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("voucher", ["A"]);
  holder = await makeActor("voucher_holder", "staff", ["vouchers"]);
  other = await makeActor("voucher_other", "staff", ["schools"]);
  await issue("Vchds Trần Minh Anh", "ZZVCH-TMA-11A3-K7Q2", new Date("2026-11-04T07:05:00Z"));
  await issue("Vchds Nguyễn Gia Bảo", "ZZVCH-NGB-11A1-M4XT", new Date("2026-11-03T17:30:00Z"));
  await issue("Vchds Lý Thanh Tâm", "ZZVCH-LTT-12A1-B9NC", new Date("2026-11-03T03:02:00Z"));
  for (let i = 0; i < 16; i++) await issue(`Vchpage Học Sinh ${i}`, `ZZVPG-HS-10A${i}-AAAA`, new Date(Date.UTC(2026, 9, 1, 0, i)));
});
afterAll(cleanTestUsers);

describe("Trang Mã voucher", () => {
  test("người có quyền Quản lý voucher thấy mọi mã, mới cấp trước; người không có quyền không thấy gì", async () => {
    expect(await codes(holder, { q: "zzvch" })).toEqual(["ZZVCH-TMA-11A3-K7Q2", "ZZVCH-NGB-11A1-M4XT", "ZZVCH-LTT-12A1-B9NC"]);
    expect((await list(other, { q: "zzvch" })).rows).toEqual([]);
  });

  test("dòng có họ tên, lớp, trường, phụ huynh, ngày cấp", async () => {
    const [row] = (await list(holder, { q: "zzvch-tma" })).rows;
    expect([row.fullName, row.className, row.schoolName, row.parentName]).toEqual(["Vchds Trần Minh Anh", "11A3", p.schoolName, "Phụ Huynh Test"]);
    expect(row.issuedAt.toISOString()).toBe("2026-11-04T07:05:00.000Z");
  });

  test("tìm theo mã không phân biệt hoa thường, theo họ tên không dấu", async () => {
    expect(await codes(holder, { q: "zzvch-ngb" })).toEqual(["ZZVCH-NGB-11A1-M4XT"]);
    expect(await codes(holder, { q: "vchds ly thanh" })).toEqual(["ZZVCH-LTT-12A1-B9NC"]);
    expect(await codes(holder, { q: "zzvch_" })).toEqual([]);
  });

  test("lọc ngày cấp theo giờ Việt Nam", async () => {
    expect(await codes(holder, { q: "zzvch", from: "2026-11-04", to: "2026-11-04" })).toEqual(["ZZVCH-TMA-11A3-K7Q2", "ZZVCH-NGB-11A1-M4XT"]);
    expect(await codes(holder, { q: "zzvch", to: "2026-11-03" })).toEqual(["ZZVCH-LTT-12A1-B9NC"]);
  });

  test("15 dòng một trang", async () => {
    const first = await list(holder, { q: "zzvpg" });
    expect([first.rows.length, first.total]).toEqual([PAGE_SIZE, 16]);
    expect((await list(holder, { q: "zzvpg" }, 9)).rows.length).toBe(1);
  });
});
