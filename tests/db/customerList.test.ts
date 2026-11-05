import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cleanTestUsers, makeActor } from "./helpers";
import { addPhotoCheck, insertCustomer, setupProgram, type Program } from "./fixtures";
import { listCustomers, PAGE_SIZE } from "../../src/server/customerList";
import { parseCustomerFilters, type CustomerFilters } from "../../src/lib/customerFilters";
import type { SessionUser } from "../../src/lib/types";

let p: Program;
let staffA: SessionUser;
let staffNone: SessionUser;
const id: Record<string, string> = {};

const filters = (f: Partial<CustomerFilters>): CustomerFilters => ({ ...parseCustomerFilters({}), ...f });
const names = async (actor: SessionUser, f: Partial<CustomerFilters>, page = 1) => (await listCustomers(actor, filters(f), page)).rows.map((r) => r.fullName);

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("list", ["A", "B", "C"]);
  staffA = await makeActor("list_staff_a", "staff", [], [p.bank.A]);
  staffNone = await makeActor("list_staff_none", "staff", [], []);
  const at = (iso: string) => new Date(iso);
  id.anh = (await insertCustomer(p, { fullName: "Locds Trần Minh Anh", status: "pending_review", submittedAt: at("2026-11-03T02:48:00Z"), banks: [{ key: "A", status: "pending" }, { key: "B", status: "pending" }] })).id;
  id.nam = (await insertCustomer(p, { fullName: "Locds Lê Hoàng Nam", status: "pending_review", submittedAt: at("2026-11-03T03:12:00Z"), banks: [{ key: "B", status: "pending" }, { key: "C", status: "pending" }] })).id;
  const bao = await insertCustomer(p, { fullName: "Locds Nguyễn Gia Bảo", status: "pending_review", submittedAt: at("2026-11-03T17:30:00Z"), parentPhone: "0909888777", banks: [{ key: "A", status: "passed" }, { key: "C", status: "pending" }] });
  id.bao = bao.id;
  const ngan = await insertCustomer(p, { fullName: "Locds Võ Thị Kim Ngân", status: "reviewed", submittedAt: at("2026-11-02T09:20:00Z"), banks: [{ key: "A", status: "passed" }, { key: "B", status: "passed" }] });
  id.ngan = ngan.id;
  id.do = (await insertCustomer(p, { fullName: "Locds Đỗ Văn Đức", status: "new" })).id;
  id.ha = (await insertCustomer(p, { fullName: "Locds Phạm Thu Hà", status: "banks_selected", banks: [{ key: "A", status: "selected" }] })).id;
  // Lượt kiểm mới nhất mới tính: Bảo có lượt cũ đủ ảnh, lượt mới thiếu.
  await addPhotoCheck(bao.rows.A, 2, 2, at("2026-11-03T18:00:00Z"));
  await addPhotoCheck(bao.rows.A, 1, 2, at("2026-11-03T19:00:00Z"));
  await addPhotoCheck(ngan.rows.A, 2, 2);
  await addPhotoCheck(ngan.rows.B, 0, 2);
  for (let i = 0; i < 17; i++) await insertCustomer(p, { fullName: `Trangds Học Sinh ${String(i).padStart(2, "0")}`, status: "reviewed", submittedAt: new Date(Date.UTC(2026, 9, 1, 0, i)), banks: [{ key: "A", status: "failed" }] });
});
afterAll(cleanTestUsers);

describe("phạm vi", () => {
  test("Quản lý thấy mọi hồ sơ, kể cả hồ sơ chưa chọn ngân hàng", async () => {
    expect((await names(p.manager, { q: "locds" })).sort()).toEqual(
      ["Locds Trần Minh Anh", "Locds Lê Hoàng Nam", "Locds Nguyễn Gia Bảo", "Locds Võ Thị Kim Ngân", "Locds Đỗ Văn Đức", "Locds Phạm Thu Hà"].sort(),
    );
  });

  test("Nhân viên chỉ thấy hồ sơ có chọn ngân hàng mình quản", async () => {
    expect((await names(staffA, { q: "locds" })).sort()).toEqual(["Locds Trần Minh Anh", "Locds Nguyễn Gia Bảo", "Locds Võ Thị Kim Ngân", "Locds Phạm Thu Hà"].sort());
    expect(await names(staffNone, { q: "locds" })).toEqual([]);
  });

  test("ô ngân hàng có trạng thái; xác thực ảnh chỉ hiện ở ngân hàng người xem quản", async () => {
    const [row] = (await listCustomers(staffA, filters({ q: "locds vo thi kim ngan" }), 1)).rows;
    expect(row.banks.map((b) => [b.slot, b.status, b.managed, b.check])).toEqual([
      [1, "passed", true, { passed: 2, total: 2 }],
      [2, "passed", false, null],
    ]);
    expect(row.reviewers).toEqual([p.manager.fullName]);
    const [mine] = (await listCustomers(p.manager, filters({ q: "locds vo thi kim ngan" }), 1)).rows;
    expect(mine.banks.map((b) => b.check)).toEqual([
      { passed: 2, total: 2 },
      { passed: 0, total: 2 },
    ]);
  });
});

describe("lọc", () => {
  test("theo trạng thái hồ sơ", async () => {
    expect((await names(p.manager, { q: "locds", status: "pending_review" })).sort()).toEqual(["Locds Trần Minh Anh", "Locds Lê Hoàng Nam", "Locds Nguyễn Gia Bảo"].sort());
  });

  test("theo ngày tạo hồ sơ, không theo ngày gửi", async () => {
    await insertCustomer(p, { fullName: "Taods Hồ Văn Sớm", status: "pending_review", createdAt: new Date("2026-11-01T02:00:00Z"), submittedAt: new Date("2026-11-04T02:00:00Z"), banks: [{ key: "A", status: "pending" }] });
    expect(await names(p.manager, { q: "taods", from: "2026-11-01", to: "2026-11-01" })).toEqual(["Taods Hồ Văn Sớm"]);
    expect(await names(p.manager, { q: "taods", from: "2026-11-04", to: "2026-11-04" })).toEqual([]);
  });

  test("theo ngày tạo tính giờ Việt Nam", async () => {
    // Bảo tạo hồ sơ lúc 00:30 ngày 04/11 giờ Việt Nam, tức 17:30 ngày 03/11 giờ UTC.
    expect(await names(p.manager, { q: "locds", from: "2026-11-04", to: "2026-11-04" })).toEqual(["Locds Nguyễn Gia Bảo"]);
    expect((await names(p.manager, { q: "locds", to: "2026-11-03" })).sort()).toEqual(["Locds Trần Minh Anh", "Locds Lê Hoàng Nam", "Locds Võ Thị Kim Ngân"].sort());
  });

  test("theo số ngân hàng đạt", async () => {
    expect(await names(p.manager, { q: "locds", passed: "1" })).toEqual(["Locds Nguyễn Gia Bảo"]);
    expect(await names(p.manager, { q: "locds", passed: "2" })).toEqual(["Locds Võ Thị Kim Ngân"]);
  });

  test("theo kết quả xác thực ảnh của lượt mới nhất, trên ngân hàng người xem quản", async () => {
    expect(await names(staffA, { q: "locds", check: "missing" })).toEqual(["Locds Nguyễn Gia Bảo"]);
    expect(await names(staffA, { q: "locds", check: "full" })).toEqual(["Locds Võ Thị Kim Ngân"]);
    expect((await names(p.manager, { q: "locds", check: "missing" })).sort()).toEqual(["Locds Nguyễn Gia Bảo", "Locds Võ Thị Kim Ngân"].sort());
  });
});

describe("tìm", () => {
  test("họ tên không phân biệt dấu, kể cả chữ đ", async () => {
    expect(await names(p.manager, { q: "locds nguyen gia bao" })).toEqual(["Locds Nguyễn Gia Bảo"]);
    expect(await names(p.manager, { q: "Locds Đỗ văn" })).toEqual(["Locds Đỗ Văn Đức"]);
    expect(await names(p.manager, { q: "locds do van duc" })).toEqual(["Locds Đỗ Văn Đức"]);
  });

  test("theo SĐT, có dấu cách hoặc dấu chấm", async () => {
    expect(await names(p.manager, { q: "0909 888.777" })).toEqual(["Locds Nguyễn Gia Bảo"]);
  });

  test("ký tự % và _ không thành ký tự đại diện", async () => {
    expect(await names(p.manager, { q: "%" })).toEqual([]);
    expect(await names(p.manager, { q: "locds_" })).toEqual([]);
  });
});

describe("phân trang và thứ tự", () => {
  test("15 dòng một trang, trang vượt quá thì về trang cuối", async () => {
    const first = await listCustomers(p.manager, filters({ q: "trangds" }), 1);
    expect([first.rows.length, first.total, first.page]).toEqual([PAGE_SIZE, 17, 1]);
    const last = await listCustomers(p.manager, filters({ q: "trangds" }), 99);
    expect([last.rows.length, last.page]).toEqual([2, 2]);
    expect(new Set([...first.rows, ...last.rows].map((r) => r.id)).size).toBe(17);
    expect((await listCustomers(p.manager, filters({ q: "trangds" }), 1.5)).page).toBe(1);
  });

  test("hồ sơ chờ kiểm tra đứng đầu, gửi trước xếp trước; còn lại mới nhất trước", async () => {
    expect(await names(p.manager, { q: "locds", status: "" })).toEqual([
      "Locds Trần Minh Anh",
      "Locds Lê Hoàng Nam",
      "Locds Nguyễn Gia Bảo",
      "Locds Phạm Thu Hà",
      "Locds Đỗ Văn Đức",
      "Locds Võ Thị Kim Ngân",
    ]);
  });
});
