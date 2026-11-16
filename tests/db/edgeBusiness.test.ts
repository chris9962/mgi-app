import { afterAll, beforeAll, describe, expect, setSystemTime, test } from "bun:test";
import { and, eq, isNull, sql } from "drizzle-orm";
import { cleanTestUsers, FAKE_WEBP, fakeStore, makeActor } from "./helpers";
import { insertCustomer, setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { customerBanks, proofPhotos, reviewEvents, smsMessages, userManagedBanks, users, vouchers } from "../../src/server/db/schema";
import { loadSessionUser } from "../../src/server/auth/session";
import { managerOptions } from "../../src/server/banks";
import { listCustomers } from "../../src/server/customerList";
import { listCustomerBanks, readCustomerBankFilters } from "../../src/server/customerBankList";
import { EXPORT_LIMIT, exportCustomerBanks, exportCustomers, exportVouchers } from "../../src/server/exports";
import { replacePhoto, reviewCustomerBank } from "../../src/server/review";
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
  process.env.VOUCHER_SECRET ||= "khoa-test";
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

  test("Mã voucher: mỗi từ khớp mã hoặc họ tên như ô tìm của mgst-app", async () => {
    for (const q of ["nta anh", "anh zztestedgeb-nta", "11a3 edgeb", "NGUYỄN aaaa"]) expect([q, names((await listVouchers(admin, parseVoucherFilters({ q }), 1)).rows)]).toEqual([q, ["Edgeb Nguyễn Thị Anh"]]);
    expect(names((await listVouchers(admin, parseVoucherFilters({ q: "nta nam" }), 1)).rows)).toEqual([]);
    expect((await exportVouchers(admin, parseVoucherFilters({ q: "nta anh" }), null)).ok).toBe(true);
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

describe("bấm Đạt trên ảnh cũ", () => {
  const photosOf = async (customerBankId: string) =>
    (await db.select({ id: proofPhotos.id }).from(proofPhotos).where(and(eq(proofPhotos.customerBankId, customerBankId), isNull(proofPhotos.replacedAt)))).map((r) => r.id);
  const STALE = "Ảnh vừa được thay. Tải lại trang để xem ảnh mới.";

  test("ảnh vừa được thay từ lúc mở trang thì 409, dòng giữ Chờ kiểm tra, không cấp voucher; mở lại trang rồi bấm thì Đạt", async () => {
    const c = await insertCustomer(p, { fullName: "Edgeb Ảnh Cũ", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }] });
    const seen = await photosOf(c.rows.A);
    expect(await replacePhoto(admin, { customerBankId: c.rows.A, slotId: p.slot.A }, FAKE_WEBP, null, fakeStore().store)).toEqual({ ok: true });
    expect(await reviewCustomerBank(admin, { customerBankId: c.rows.A, result: "passed", expected: "pending", photos: seen }, null)).toMatchObject({ ok: false, status: 409, message: STALE });
    expect((await db.select({ status: customerBanks.status }).from(customerBanks).where(eq(customerBanks.id, c.rows.A)))[0].status).toBe("pending");
    expect(await db.select().from(vouchers).where(eq(vouchers.customerId, c.id))).toEqual([]);
    expect(await db.select().from(reviewEvents).where(eq(reviewEvents.customerBankId, c.rows.A))).toEqual([]);

    expect(await reviewCustomerBank(admin, { customerBankId: c.rows.A, result: "passed", expected: "pending", photos: await photosOf(c.rows.A) }, null)).toEqual({ ok: true });
    expect((await db.select().from(vouchers).where(eq(vouchers.customerId, c.id))).length).toBe(1);
  });

  test("Không đạt đảo lại được nên không xét ảnh", async () => {
    const c = await insertCustomer(p, { fullName: "Edgeb Ảnh Cũ Hai", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }] });
    expect(await replacePhoto(admin, { customerBankId: c.rows.A, slotId: p.slot.A }, FAKE_WEBP, null, fakeStore().store)).toEqual({ ok: true });
    expect(await reviewCustomerBank(admin, { customerBankId: c.rows.A, result: "failed", expected: "pending", photos: [] }, null)).toEqual({ ok: true });
  });
});

describe("tên file Excel theo ngày giờ Việt Nam", () => {
  test("xuất lúc 00:30 ngày 01/11 giờ Việt Nam trên máy chủ đặt giờ UTC thì tên file ghi 2026-11-01", async () => {
    const tz = process.env.TZ;
    process.env.TZ = "UTC";
    setSystemTime(new Date("2026-10-31T17:30:00Z"));
    try {
      expect(new Date().getDate()).toBe(31);
      expect(await exportCustomers(admin, parseCustomerFilters({ q: "edgeb" }), null)).toMatchObject({ ok: true, fileName: "ho-so-hoc-sinh-2026-11-01.xlsx" });
      expect(await exportCustomerBanks(admin, (await readCustomerBankFilters(admin, { q: "edgeb" })).filters, null)).toMatchObject({ ok: true, fileName: "ngan-hang-2026-11-01.xlsx" });
      expect(await exportVouchers(admin, parseVoucherFilters({ q: "edgeb" }), null)).toMatchObject({ ok: true, fileName: "ma-voucher-2026-11-01.xlsx" });
    } finally {
      setSystemTime();
      if (tz === undefined) delete process.env.TZ;
      else process.env.TZ = tz;
    }
  });
});

describe("xuất Excel quá 20.000 dòng", () => {
  test("Hồ sơ, Ngân hàng, Mã voucher báo số dòng và không dựng file", async () => {
    const big = await setupProgram("bigx", ["A"]);
    const ofSchool = sql`select id from customers where school_id = ${big.schoolId}`;
    // Dựng thẳng bằng generate_series: 20.001 lần insertCustomer mất vài phút.
    await db.execute(sql`
      insert into customers (school_id, full_name, name_search, class_name, phone, parent_phone, status, token_hash, submitted_at)
      select ${big.schoolId}, 'Bigx ' || g, 'bigx ' || g, '10A1', '09' || lpad(g::text, 8, '0'), '08' || lpad(g::text, 8, '0'), 'reviewed', md5('bigx-' || g || '-' || random()), now()
      from generate_series(1, ${EXPORT_LIMIT + 1}) g`);
    await db.execute(sql`
      insert into customer_banks (customer_id, bank_id, slot, referral_code_id, referral_code, year_month, status, submitted_at)
      select id, ${big.bank.A}, 1, ${big.code.A}, 'BIGX-A', '2026-11', 'pending', now() from customers where school_id = ${big.schoolId}`);
    await db.execute(sql`insert into vouchers (code, customer_id) select 'ZZTESTBIGX-' || id, id from customers where school_id = ${big.schoolId}`);
    try {
      const n = EXPORT_LIMIT + 1;
      const tooMany = { ok: false, status: 400, message: `Danh sách có ${n} dòng, quá ${EXPORT_LIMIT} dòng một file. Lọc bớt rồi xuất lại.` } as const;
      expect(await exportCustomers(admin, parseCustomerFilters({ q: "bigx" }), null)).toEqual(tooMany);
      expect(await exportCustomerBanks(admin, (await readCustomerBankFilters(admin, { q: "bigx" })).filters, null)).toEqual(tooMany);
      expect(await exportVouchers(admin, parseVoucherFilters({ q: "bigx" }), null)).toEqual(tooMany);
      expect((await exportCustomers(admin, parseCustomerFilters({ q: "bigx 20001" }), null)).ok).toBe(true);
    } finally {
      await db.execute(sql`delete from vouchers where customer_id in (${ofSchool})`);
      await db.execute(sql`delete from customer_banks where customer_id in (${ofSchool})`);
      await db.execute(sql`delete from customers where school_id = ${big.schoolId}`);
    }
  }, 60_000);
});

describe("ô chọn người quản ở hộp Ngân hàng tìm theo Mã tài khoản", () => {
  test("gõ mã hay một phần mã ra đúng người như ô tìm Tài khoản; nhãn dòng ghi mã như ô chọn nhân viên của mgst-app", async () => {
    const [u] = await db.insert(users).values({ username: "zz_test_edgeb_maql", fullName: "Edgeb Người Có Mã", staffCode: "ZZT-MQL-5521", title: "Kế toán", passwordHash: "x", role: "staff" }).returning({ id: users.id });
    for (const q of ["ZZT-MQL-5521", "mql-5521", "5521 co ma"]) expect([q, (await managerOptions(q)).map((o) => o.id)]).toEqual([q, [u.id]]);
    expect(await managerOptions("zzt-mql-5521")).toEqual([{ id: u.id, label: "ZZT-MQL-5521 - Edgeb Người Có Mã - Kế toán" }]);
    expect((await managerOptions("Edgeb Người Có Mã khongco")).length).toBe(0);
  });
});
