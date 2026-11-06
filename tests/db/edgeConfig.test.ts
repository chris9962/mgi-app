import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TEST_NAME, TEST_PREFIX, cleanTestUsers, makeActor } from "./helpers";
import { createBank, getGuide, saveGuide, updateBank } from "../../src/server/banks";
import { createCode, updateCode } from "../../src/server/referralCodes";
import { createSchool, setSchoolActive } from "../../src/server/schools";
import { createUser, resetPassword, setActive, updateUser } from "../../src/server/users";
import { SESSION_COOKIE, createSession } from "../../src/server/auth/session";
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

describe("ca biên cấu hình: tài khoản", () => {
  test("Quản lý thao tác với tài khoản Quản trị nhận 403; không ai tự đặt lại mật khẩu của mình", async () => {
    expect(await resetPassword(manager, admin.id)).toMatchObject({ ok: false, status: 403 });
    expect(await setActive(manager, admin.id, false)).toMatchObject({ ok: false, status: 403 });
    expect(await updateUser(manager, admin.id, userForm("edge_admin", { role: "admin" }))).toMatchObject({ ok: false, status: 403 });
    expect(await createUser(manager, userForm("edge_new_admin", { role: "admin" }))).toMatchObject({ ok: false, status: 403 });
    expect(await resetPassword(admin, admin.id)).toMatchObject({ ok: false, status: 400 });
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
