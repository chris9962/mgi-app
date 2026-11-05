import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cleanTestUsers, makeActor, TEST_NAME } from "./helpers";
import { addPhotoCheck, insertCustomer, setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { photoChecks } from "../../src/server/db/schema";
import { createSchool, setSchoolActive } from "../../src/server/schools";
import { SESSION_COOKIE, createSession } from "../../src/server/auth/session";
import { GET as schoolOptionsRoute } from "../../src/app/api/admin/customer-banks/schools/route";
import { listCustomerBanks, PAGE_SIZE, readCustomerBankFilters, scopedBanks } from "../../src/server/customerBankList";
import { parseCustomerBankFilters, type CustomerBankFilters } from "../../src/lib/customerBankFilters";
import { SchoolForm } from "../../src/lib/schoolForm";
import type { SessionUser } from "../../src/lib/types";

let p: Program;
let staffA: SessionUser;
let staffNone: SessionUser;
let otherSchool: string;
const rowId: Record<string, string> = {};

const filters = (f: Partial<CustomerBankFilters>): CustomerBankFilters => ({ ...parseCustomerBankFilters({}), ...f });
const list = (actor: SessionUser, f: Partial<CustomerBankFilters>, page = 1) => listCustomerBanks(actor, filters(f), page);
const lines = async (actor: SessionUser, f: Partial<CustomerBankFilters>) => (await list(actor, f)).rows.map((r) => `${r.fullName} ${r.bankName.split(" ").pop()}`);

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("nh", ["A", "B", "C"]);
  staffA = await makeActor("nh_staff_a", "staff", [], [p.bank.A]);
  staffNone = await makeActor("nh_staff_none", "staff", [], []);
  const s = await createSchool(p.manager, SchoolForm.parse({ name: `${TEST_NAME}THPT nh khác`, provinceCode: "80", wardCode: "25585", contactName: "B", contactPhone: "0903111333" }));
  if (!s.ok) throw new Error(s.message);
  otherSchool = s.id;
  const at = (iso: string) => new Date(iso);
  const anh = await insertCustomer(p, { fullName: "Nhds Trần Minh Anh", status: "pending_review", createdAt: at("2026-11-03T02:00:00Z"), submittedAt: at("2026-11-03T02:48:00Z"), banks: [{ key: "A", status: "pending" }, { key: "B", status: "pending" }] });
  Object.assign(rowId, { anhA: anh.rows.A, anhB: anh.rows.B });
  await insertCustomer(p, { fullName: "Nhds Lê Hoàng Nam", status: "pending_review", createdAt: at("2026-11-02T03:00:00Z"), submittedAt: at("2026-11-03T03:12:00Z"), banks: [{ key: "B", status: "pending" }, { key: "C", status: "pending" }] });
  // Bảo tạo hồ sơ lúc 00:30 ngày 04/11 giờ Việt Nam, tức 17:30 ngày 03/11 giờ UTC.
  const bao = await insertCustomer(p, { fullName: "Nhds Nguyễn Gia Bảo", status: "pending_review", parentPhone: "0909888711", createdAt: at("2026-11-03T17:30:00Z"), submittedAt: at("2026-11-03T18:00:00Z"), banks: [{ key: "A", status: "passed" }, { key: "C", status: "failed" }] });
  rowId.baoA = bao.rows.A;
  const ngan = await insertCustomer({ ...p, schoolId: otherSchool }, { fullName: "Nhds Võ Thị Kim Ngân", status: "reviewed", createdAt: at("2026-11-01T09:00:00Z"), submittedAt: at("2026-11-01T09:20:00Z"), banks: [{ key: "A", status: "passed" }, { key: "B", status: "passed" }] });
  Object.assign(rowId, { nganA: ngan.rows.A, nganB: ngan.rows.B });
  await insertCustomer(p, { fullName: "Nhds Đỗ Văn Đức", status: "new", createdAt: at("2026-11-04T01:00:00Z") });
  await insertCustomer(p, { fullName: "Nhds Phạm Thu Hà", status: "banks_selected", createdAt: at("2026-10-31T01:00:00Z"), banks: [{ key: "A", status: "selected" }] });
  // Lượt kiểm mới nhất mới tính: Bảo có lượt cũ đủ ảnh, lượt mới thiếu.
  await addPhotoCheck(rowId.baoA, 2, 2, at("2026-11-03T18:10:00Z"));
  await addPhotoCheck(rowId.baoA, 1, 2, at("2026-11-03T18:20:00Z"));
  await addPhotoCheck(rowId.nganA, 2, 2);
  await addPhotoCheck(rowId.nganB, 0, 2);
  await db.insert(photoChecks).values({ customerBankId: rowId.anhA, status: "pending" });
  for (let i = 0; i < 9; i++) await insertCustomer(p, { fullName: `Trangnh Học Sinh ${String(i).padStart(2, "0")}`, status: "reviewed", createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)), banks: [{ key: "A", status: "failed" }, { key: "B", status: "passed" }] });
});
afterAll(cleanTestUsers);

describe("mỗi ngân hàng một dòng", () => {
  test("học sinh chọn 2 ngân hàng ra 2 dòng theo thứ tự chọn; hồ sơ chưa chọn ngân hàng không có dòng", async () => {
    const { rows, total } = await list(p.manager, { q: "nhds tran minh anh" });
    expect(total).toBe(2);
    expect(rows.map((r) => [r.slot, r.bankName, r.status, r.referralCode, r.className, r.schoolName])).toEqual([
      [1, `${TEST_NAME}nh A`, "pending", "CODE-A", "11A3", p.schoolName],
      [2, `${TEST_NAME}nh B`, "pending", "CODE-B", "11A3", p.schoolName],
    ]);
    expect((await list(p.manager, { q: "nhds do van duc" })).total).toBe(0);
  });

  test("người kiểm và ngày tạo hồ sơ của từng dòng", async () => {
    const [row] = (await list(p.manager, { q: "nhds nguyen gia bao" })).rows;
    expect([row.reviewer, row.createdAt]).toEqual([p.manager.fullName, new Date("2026-11-03T17:30:00Z")]);
    expect((await list(p.manager, { q: "nhds pham thu ha" })).rows[0].reviewer).toBeNull();
  });
});

describe("phạm vi", () => {
  test("Nhân viên chỉ thấy dòng của ngân hàng mình quản", async () => {
    expect((await lines(staffA, { q: "nhds" })).sort()).toEqual(["Nhds Trần Minh Anh A", "Nhds Nguyễn Gia Bảo A", "Nhds Võ Thị Kim Ngân A", "Nhds Phạm Thu Hà A"].sort());
    expect((await list(staffNone, { q: "nhds" })).total).toBe(0);
  });

  test("xác thực ảnh là lượt mới nhất; Nhân viên không thấy x/y của ngân hàng khác", async () => {
    const mine = (await list(staffA, { q: "nhds" })).rows;
    expect(mine.find((r) => r.id === rowId.baoA)?.check).toEqual({ status: "done", passed: 1, total: 2 });
    expect(mine.find((r) => r.id === rowId.anhA)?.check).toEqual({ status: "pending", passed: 0, total: 0 });
    expect(mine.find((r) => r.id === rowId.nganB)).toBeUndefined();
    const all = (await list(p.manager, { q: "nhds vo thi kim ngan" })).rows;
    expect(all.map((r) => r.check)).toEqual([
      { status: "done", passed: 2, total: 2 },
      { status: "done", passed: 0, total: 2 },
    ]);
    expect((await list(p.manager, { q: "nhds pham thu ha" })).rows[0].check).toBeNull();
  });

  test("ô lọc ngân hàng chỉ có ngân hàng trong phạm vi người xem", async () => {
    expect((await scopedBanks(staffA)).map((b) => b.id)).toEqual([p.bank.A]);
    expect(await scopedBanks(staffNone)).toEqual([]);
    expect((await scopedBanks(p.manager)).map((b) => b.id)).toEqual(expect.arrayContaining([p.bank.A, p.bank.B, p.bank.C]));
  });
});

describe("lọc", () => {
  test("theo một hoặc nhiều ngân hàng; Nhân viên lọc ngân hàng ngoài phạm vi thì rỗng", async () => {
    expect((await lines(p.manager, { q: "nhds", bank: [p.bank.C] })).sort()).toEqual(["Nhds Lê Hoàng Nam C", "Nhds Nguyễn Gia Bảo C"].sort());
    expect((await list(p.manager, { q: "nhds", bank: [p.bank.B, p.bank.C] })).total).toBe(5);
    expect((await list(staffA, { q: "nhds", bank: [p.bank.B] })).total).toBe(0);
  });

  test("theo trạng thái của dòng ngân hàng", async () => {
    expect((await lines(p.manager, { q: "nhds", status: "passed" })).sort()).toEqual(["Nhds Nguyễn Gia Bảo A", "Nhds Võ Thị Kim Ngân A", "Nhds Võ Thị Kim Ngân B"].sort());
    expect(await lines(p.manager, { q: "nhds", status: "failed" })).toEqual(["Nhds Nguyễn Gia Bảo C"]);
  });

  test("theo xác thực ảnh của lượt mới nhất", async () => {
    expect((await lines(p.manager, { q: "nhds", check: "missing" })).sort()).toEqual(["Nhds Nguyễn Gia Bảo A", "Nhds Võ Thị Kim Ngân B"].sort());
    expect(await lines(p.manager, { q: "nhds", check: "full" })).toEqual(["Nhds Võ Thị Kim Ngân A"]);
  });

  test("theo trường", async () => {
    expect(await lines(p.manager, { q: "nhds", school: [otherSchool] })).toEqual(["Nhds Võ Thị Kim Ngân A", "Nhds Võ Thị Kim Ngân B"]);
    expect((await list(p.manager, { q: "nhds", school: [otherSchool, p.schoolId] })).total).toBe(9);
  });

  test("theo ngày tạo hồ sơ tính giờ Việt Nam", async () => {
    expect(await lines(p.manager, { q: "nhds", from: "2026-11-04", to: "2026-11-04" })).toEqual(["Nhds Nguyễn Gia Bảo A", "Nhds Nguyễn Gia Bảo C"]);
    expect((await lines(p.manager, { q: "nhds", from: "2026-11-02", to: "2026-11-03" })).sort()).toEqual(["Nhds Trần Minh Anh A", "Nhds Trần Minh Anh B", "Nhds Lê Hoàng Nam B", "Nhds Lê Hoàng Nam C"].sort());
  });
});

describe("tìm", () => {
  test("họ tên không phân biệt dấu, hoặc SĐT phụ huynh có dấu cách", async () => {
    expect(await lines(p.manager, { q: "nhds nguyen gia bao" })).toEqual(["Nhds Nguyễn Gia Bảo A", "Nhds Nguyễn Gia Bảo C"]);
    expect(await lines(p.manager, { q: "0909 888.711" })).toEqual(["Nhds Nguyễn Gia Bảo A", "Nhds Nguyễn Gia Bảo C"]);
    expect((await list(p.manager, { q: "%" })).total).toBe(0);
  });
});

describe("phân trang và thứ tự", () => {
  test("15 dòng một trang, trang vượt quá thì về trang cuối", async () => {
    const first = await list(p.manager, { q: "trangnh" }, 1);
    expect([first.rows.length, first.total, first.page]).toEqual([PAGE_SIZE, 18, 1]);
    const last = await list(p.manager, { q: "trangnh" }, 99);
    expect([last.rows.length, last.page]).toEqual([3, 2]);
    expect(new Set([...first.rows, ...last.rows].map((r) => r.id)).size).toBe(18);
  });

  test("hồ sơ tạo mới nhất trước, trong một hồ sơ theo thứ tự chọn; đổi chiều thì cũ nhất trước", async () => {
    const order = ["Nhds Nguyễn Gia Bảo A", "Nhds Nguyễn Gia Bảo C", "Nhds Trần Minh Anh A", "Nhds Trần Minh Anh B", "Nhds Lê Hoàng Nam B", "Nhds Lê Hoàng Nam C", "Nhds Võ Thị Kim Ngân A", "Nhds Võ Thị Kim Ngân B", "Nhds Phạm Thu Hà A"];
    expect(await lines(p.manager, { q: "nhds" })).toEqual(order);
    expect(await lines(p.manager, { q: "nhds", dir: "asc" })).toEqual(["Nhds Phạm Thu Hà A", "Nhds Võ Thị Kim Ngân A", "Nhds Võ Thị Kim Ngân B", "Nhds Lê Hoàng Nam B", "Nhds Lê Hoàng Nam C", "Nhds Trần Minh Anh A", "Nhds Trần Minh Anh B", "Nhds Nguyễn Gia Bảo A", "Nhds Nguyễn Gia Bảo C"]);
  });
});

describe("ô tìm trường của bộ lọc", () => {
  const SITE = `http://${process.env.ADMIN_HOST ?? "admin.localhost"}:3100`;
  const get = async (actor: SessionUser, q: string) =>
    schoolOptionsRoute(new Request(`${SITE}/api/admin/customer-banks/schools?q=${encodeURIComponent(q)}`, { headers: { Origin: SITE, Cookie: `${SESSION_COOKIE}=${(await createSession(actor.id)).token}` } }));

  test("người xem hồ sơ tìm được cả trường đã đóng; người không có quyền hồ sơ nhận 403", async () => {
    await setSchoolActive(p.manager, otherSchool, false);
    const res = await get(staffA, "thpt nh khac");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { id: string }[]).map((o) => o.id)).toEqual([otherSchool]);
    expect((await get(staffNone, "thpt nh")).status).toBe(403);
  });
});

describe("bộ lọc đọc từ URL theo phạm vi người xem", () => {
  test("ngân hàng ngoài phạm vi và trường không có bị bỏ, bộ lọc trên trang khớp bộ lọc đang áp", async () => {
    const missing = "99999999-9999-4999-8999-999999999999";
    const { filters, banks, schools } = await readCustomerBankFilters(staffA, { q: "nhds", bank: `${p.bank.B},${p.bank.A}`, school: `${missing},${otherSchool}` });
    expect([filters.bank, filters.school]).toEqual([[p.bank.A], [otherSchool]]);
    expect(banks.map((b) => b.id)).toEqual([p.bank.A]);
    expect(schools.map((s) => s.id)).toEqual([otherSchool]);
    const outside = await readCustomerBankFilters(staffA, { q: "nhds", bank: p.bank.B });
    expect(outside.filters.bank).toEqual([]);
    expect((await listCustomerBanks(staffA, outside.filters, 1)).total).toBe(4);
    expect((await readCustomerBankFilters(p.manager, { bank: `${p.bank.B},${missing}` })).filters.bank).toEqual([p.bank.B]);
  });
});
