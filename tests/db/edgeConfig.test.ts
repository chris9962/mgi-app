import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { TEST_NAME, TEST_PREFIX, cleanTestUsers, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { settings, users } from "../../src/server/db/schema";
import { createBank, getGuide, managerOptions, saveGuide, setBankActive, updateBank } from "../../src/server/banks";
import { createCode, listCodes, updateCode } from "../../src/server/referralCodes";
import { createSchool, listSchools, searchSchoolOptions, setSchoolActive } from "../../src/server/schools";
import { createUser, listUsers, resetPassword, setActive, updateUser } from "../../src/server/users";
import { SESSION_COOKIE, createSession } from "../../src/server/auth/session";
import { attemptLogin } from "../../src/server/auth/login";
import { GET as schoolExportRoute } from "../../src/app/api/admin/schools/export/route";
import { GET as schoolOptionsRoute } from "../../src/app/api/admin/schools/options/route";
import { GET as managerOptionsRoute } from "../../src/app/api/admin/users/options/route";
import { GET as filterSchoolsRoute } from "../../src/app/api/admin/customer-banks/schools/route";
import { BankForm, GuideForm } from "../../src/lib/bankForm";
import { CodeForm } from "../../src/lib/codeForm";
import { SchoolForm } from "../../src/lib/schoolForm";
import { UserForm } from "../../src/lib/userForm";
import type { SessionUser } from "../../src/lib/types";

const MISSING = "00000000-0000-4000-8000-00000000c0de";
const bankForm = (code: string, name: string, managerIds: string[] = []) => BankForm.parse({ code, name: TEST_NAME + name, sortOrder: "1", managerIds });
const codeForm = (bankId: string, name: string, schoolIds: string[] = []) =>
  CodeForm.parse({ bankId, displayName: TEST_NAME + name, code: "EDGE", qrKey: null, openUrl: "", monthlyQuota: "10", priority: "0", schoolIds });
const userForm = (username: string, extra: Record<string, unknown> = {}) =>
  UserForm.parse({ fullName: "Test biên", staffCode: "", phone: "", username: TEST_PREFIX + username, role: "staff", title: "", permissions: [], ...extra });

let admin: SessionUser;
let manager: SessionUser;

beforeAll(async () => {
  await cleanTestUsers();
  admin = await makeActor("edge_admin", "admin");
  manager = await makeActor("edge_manager", "manager");
});
afterAll(cleanTestUsers);

describe("ca biên cấu hình: ghi cùng lúc", () => {
  test("ba lượt tạo cùng mã ngân hàng cùng lúc: một lượt tạo, hai lượt báo trùng ở ô mã", async () => {
    const results = await Promise.all([1, 2, 3].map(() => createBank(admin, bankForm("ZZTRACE", "Đồng thời"))));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([expect.objectContaining({ field: "code", status: 409 }), expect.objectContaining({ field: "code", status: 409 })]);
  });

  test("ba lượt tạo cùng tên mã trong một ngân hàng cùng lúc: một lượt tạo, hai lượt báo trùng ở ô tên", async () => {
    const bank = await createBank(admin, bankForm("ZZTRACE2", "Đồng thời mã"));
    if (!bank.ok) throw new Error(bank.message);
    const results = await Promise.all([1, 2, 3].map(() => createCode(admin, codeForm(bank.id, "Mã đồng thời"))));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([expect.objectContaining({ field: "displayName", status: 409 }), expect.objectContaining({ field: "displayName", status: 409 })]);
  });

  test("ba lượt tạo cùng tên đăng nhập cùng lúc: một lượt tạo, hai lượt báo trùng ở ô tên đăng nhập", async () => {
    const results = await Promise.all([1, 2, 3].map(() => createUser(admin, userForm("edge_race"))));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([expect.objectContaining({ field: "username", status: 409 }), expect.objectContaining({ field: "username", status: 409 })]);
  });
});

describe("ca biên cấu hình: dữ liệu đã đổi hoặc không có", () => {
  test("người quản đã bị khoá vẫn giữ khi sửa ngân hàng; giao thêm người đã khoá thì bị từ chối", async () => {
    const keep = await makeActor("edge_keep", "staff");
    const bank = await createBank(admin, bankForm("ZZTKEEP", "Giữ người quản", [keep.id]));
    if (!bank.ok) throw new Error(bank.message);
    expect((await setActive(admin, keep.id, false)).ok).toBe(true);
    expect((await updateBank(admin, bank.id, bankForm("ZZTKEEP", "Giữ người quản sửa", [keep.id]))).ok).toBe(true);
    const fresh = await makeActor("edge_fresh", "staff");
    expect((await setActive(admin, fresh.id, false)).ok).toBe(true);
    expect(await updateBank(admin, bank.id, bankForm("ZZTKEEP", "Giữ người quản sửa", [keep.id, fresh.id]))).toMatchObject({ ok: false, field: "managerIds" });
  });

  test("hướng dẫn của ngân hàng không có: đọc ra null, lưu trả 404", async () => {
    expect(await getGuide(MISSING)).toBeNull();
    expect(await saveGuide(admin, MISSING, GuideForm.parse({ steps: [], slots: [{ name: "A", sampleKey: null, checkName: false, checkCode: false }] }))).toMatchObject({ ok: false, status: 404 });
  });

  test("mã với ngân hàng không có trả 404 ở ô ngân hàng; trường không có, trường đã đóng bị từ chối khi gắn thêm, trường đã gắn rồi mới đóng vẫn giữ", async () => {
    expect(await createCode(admin, codeForm(MISSING, "Ngân hàng lạ"))).toMatchObject({ ok: false, status: 404, field: "bankId" });
    const bank = await createBank(admin, bankForm("ZZTSCH", "Trường đóng"));
    const school = await createSchool(admin, SchoolForm.parse({ name: TEST_NAME + "Trường sẽ đóng", provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903 111 222" }));
    if (!bank.ok || !school.ok) throw new Error("tạo dữ liệu lỗi");
    expect(await createCode(admin, codeForm(bank.id, "Trường lạ", [MISSING]))).toMatchObject({ ok: false, field: "schoolIds" });
    const code = await createCode(admin, codeForm(bank.id, "Gắn trường", [school.id]));
    if (!code.ok) throw new Error(code.message);
    expect((await setSchoolActive(admin, school.id, false)).ok).toBe(true);
    expect((await updateCode(admin, code.id, codeForm(bank.id, "Gắn trường sửa", [school.id]))).ok).toBe(true);
    expect(await createCode(admin, codeForm(bank.id, "Gắn trường đóng", [school.id]))).toMatchObject({ ok: false, field: "schoolIds" });
  });
});

describe("ca biên cấu hình: ngân hàng đã tắt", () => {
  test("tạo mã cho ngân hàng đã tắt trả 400 ở ô ngân hàng; mã đã có của ngân hàng đó vẫn sửa được", async () => {
    const bank = await createBank(admin, bankForm("ZZTTAT", "Ngân hàng tắt"));
    if (!bank.ok) throw new Error(bank.message);
    const code = await createCode(admin, codeForm(bank.id, "Mã có trước"));
    if (!code.ok) throw new Error(code.message);
    expect((await setBankActive(admin, bank.id, false)).ok).toBe(true);
    expect(await createCode(admin, codeForm(bank.id, "Mã sau khi tắt"))).toEqual({ ok: false, status: 400, field: "bankId", message: "Ngân hàng đã tắt." });
    expect((await updateCode(admin, code.id, codeForm(bank.id, "Mã có trước sửa"))).ok).toBe(true);
  });
});

describe("ca biên cấu hình: tài khoản", () => {
  test("Quản lý thao tác với tài khoản Quản trị nhận 403; không ai tự đặt lại mật khẩu của mình", async () => {
    expect(await resetPassword(manager, admin.id)).toMatchObject({ ok: false, status: 403 });
    expect(await setActive(manager, admin.id, false)).toMatchObject({ ok: false, status: 403 });
    expect(await updateUser(manager, admin.id, userForm("edge_admin", { role: "admin" }))).toMatchObject({ ok: false, status: 403 });
    expect(await createUser(manager, userForm("edge_new_admin", { role: "admin" }))).toMatchObject({ ok: false, status: 403 });
    expect(await resetPassword(admin, admin.id)).toMatchObject({ ok: false, status: 400 });
  });

  test("đăng nhập với tên có NUL hay ký tự điều khiển báo sai như tên không có thật, không lỗi", async () => {
    for (const username of [`${TEST_PREFIX}edge_admin\u0000`, "\u0000", `${TEST_PREFIX}edge\u0001admin`]) {
      expect([JSON.stringify(username), await attemptLogin(username, "x")]).toEqual([JSON.stringify(username), expect.objectContaining({ ok: false, code: "bad_credentials" })]);
    }
  });

  test("SĐT có dấu cách, dấu chấm lưu thành 10 số liền", async () => {
    expect(userForm("edge_phone", { phone: "0903 111.222" }).phone).toBe("0903111222");
    expect(userForm("edge_phone", { phone: "   " }).phone).toBeNull();
  });
});

describe("ca biên cấu hình: từ khoá có ký tự NUL trên URL", () => {
  const SITE = `http://${process.env.ADMIN_HOST ?? "admin.localhost"}:3100`;
  const get = async (path: string) => new Request(`${SITE}${path}`, { headers: { Origin: SITE, Cookie: `${SESSION_COOKIE}=${(await createSession(admin.id)).token}` } });

  test("Xuất Excel trang Trường với q=%00 trả file, không lỗi 500", async () => {
    for (const q of ["%00", "a%00b", "zztest%00"]) expect([q, (await schoolExportRoute(await get(`/api/admin/schools/export?q=${q}`))).status]).toEqual([q, 200]);
  });

  // containsPattern cũng bỏ NUL, nên test này vẫn pass khi bỏ readParam của 32fd07d: nó giữ luật q=%00 như ô trống, không đo bản sửa đó.
  test("ô chọn trường, ô chọn người quản, ô tìm trường của bộ lọc: q=%00 như ô trống", async () => {
    for (const [route, path] of [
      [schoolOptionsRoute, "/api/admin/schools/options"],
      [managerOptionsRoute, "/api/admin/users/options"],
      [filterSchoolsRoute, "/api/admin/customer-banks/schools"],
    ] as const) {
      const nul = await route(await get(`${path}?q=%00`));
      expect([path, nul.status]).toEqual([path, 200]);
      expect(await nul.json()).toEqual(await (await route(await get(`${path}?q=`))).json());
    }
  });
});

describe("ca biên cấu hình: thứ tự Kho mã", () => {
  test("16 mã cùng thứ tự ngân hàng, cùng độ ưu tiên, cùng tên: xếp theo id, hai trang không lặp, không sót mã nào", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 16; i++) {
      const bank = await createBank(admin, bankForm(`ZZTORD${i}`, `Thứ tự ${i}`));
      if (!bank.ok) throw new Error(bank.message);
      const code = await createCode(admin, codeForm(bank.id, "Mã trùng thứ tự"));
      if (!code.ok) throw new Error(code.message);
      ids.push(code.id);
    }
    const list = (page: number) => listCodes(admin, { month: "2026-11", q: "zztest ma trung thu tu", bankId: "", hideStopped: false, page });
    const [one, two] = [await list(1), await list(2)];
    expect([one.rows.length, two.rows.length]).toEqual([15, 1]);
    expect([...one.rows, ...two.rows].map((r) => r.id)).toEqual(ids.toSorted());
  });
});

describe("ca biên cấu hình: tìm nhiều từ như mgst-app, mỗi từ một điều kiện, không theo thứ tự", () => {
  test("Trường, ô chọn trường: mỗi từ khớp tên trường hoặc tên xã; cắt ở 8 từ và 100 ký tự", async () => {
    const school = await createSchool(admin, SchoolForm.parse({ name: TEST_NAME + "THPT Nguyễn Thị Anh Táchds", provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" }));
    if (!school.ok) throw new Error(school.message);
    const found = async (q: string) => (await listSchools({ q, page: 1 })).rows.map((r) => r.id);
    for (const q of ["anh nguyen tachds", "tachds chau thanh", "TÁCHDS  zztest   ANH", "zztest thpt nguyen thi anh tachds chau thanh khongco", `tachds${" ".repeat(94)}khongco`])
      expect([q, await found(q)]).toEqual([q, [school.id]]);
    expect(await found("tachds khongco")).toEqual([]);
    expect((await searchSchoolOptions("anh nguyen tachds chau")).map((o) => o.id)).toEqual([school.id]);
  });

  test("Tài khoản, ô chọn người quản: mỗi từ khớp họ tên hoặc tên đăng nhập", async () => {
    const user = await createUser(admin, userForm("tachds_user", { fullName: "Nguyễn Thị Anh Táchds" }));
    if (!user.ok) throw new Error(user.message);
    const found = async (q: string) => (await listUsers({ q, page: 1 })).rows.map((r) => r.id);
    for (const q of ["anh nguyen tachds", "tachds_user anh", "zz_test_tachds THỊ"]) expect([q, await found(q)]).toEqual([q, [user.id]]);
    expect(await found("anh tachds khongco")).toEqual([]);
    expect((await managerOptions("anh nguyen tachds")).map((o) => o.id)).toEqual([user.id]);
  });

  test("Kho mã: mỗi từ khớp tên hiển thị hoặc mã text", async () => {
    const bank = await createBank(admin, bankForm("ZZTTACH", "Tách từ"));
    if (!bank.ok) throw new Error(bank.message);
    const code = await createCode(admin, CodeForm.parse({ bankId: bank.id, displayName: TEST_NAME + "Mã Nguyễn Thị Anh Táchds", code: "TACHCODE", qrKey: null, openUrl: "", monthlyQuota: "10", priority: "0", schoolIds: [] }));
    if (!code.ok) throw new Error(code.message);
    const found = async (q: string) => (await listCodes(admin, { month: "2026-11", q, bankId: "", hideStopped: false, page: 1 })).rows.map((r) => r.id);
    for (const q of ["anh nguyen tachds", "tachcode anh", "TÁCHDS mã"]) expect([q, await found(q)]).toEqual([q, [code.id]]);
    expect(await found("tachds khongco")).toEqual([]);
  });
});

// Chạy cuối file: cleanTestUsers xoá cả tài khoản test mà các describe khác dùng chung.
describe("ca biên cấu hình: dọn dữ liệu test", () => {
  test("câu dọn chỉ chọn đúng tiền tố zz_test_: dấu _ là chữ, không phải ký tự đại diện", async () => {
    const [other] = await db.insert(users).values({ username: "zzxtestxkhac", fullName: "Không phải dữ liệu test", passwordHash: "x", role: "staff" }).returning({ id: users.id });
    await db.insert(settings).values({ key: "zzxtestxkhac", value: "x" });
    try {
      await cleanTestUsers();
      expect(await db.select({ id: users.id }).from(users).where(eq(users.id, other.id))).toHaveLength(1);
      expect(await db.select({ key: settings.key }).from(settings).where(eq(settings.key, "zzxtestxkhac"))).toHaveLength(1);
    } finally {
      await db.delete(users).where(eq(users.id, other.id));
      await db.delete(settings).where(eq(settings.key, "zzxtestxkhac"));
    }
  });
});
