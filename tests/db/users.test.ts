import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { TEST_PREFIX, cleanTestUsers } from "./helpers";
import { db } from "../../src/server/db/client";
import { auditLog, users } from "../../src/server/db/schema";
import { attemptLogin } from "../../src/server/auth/login";
import { createSession, loadSessionUser, userFromToken } from "../../src/server/auth/session";
import { createUser, listUsers, resetPassword, setActive, updateUser } from "../../src/server/users";
import { UserForm, type UserFormInput } from "../../src/lib/userForm";
import type { SessionUser } from "../../src/lib/types";

const form = (name: string, extra: Partial<UserFormInput> = {}) =>
  UserForm.parse({ fullName: "Test " + name, staffCode: "", phone: "", username: TEST_PREFIX + name, role: "staff", title: "", permissions: [], ...extra });

let admin: SessionUser;
let manager: SessionUser;

beforeAll(async () => {
  await cleanTestUsers();
  const [a] = await db.insert(users).values({ username: TEST_PREFIX + "admin", fullName: "Admin", passwordHash: "x", role: "admin" }).returning({ id: users.id });
  const [m] = await db.insert(users).values({ username: TEST_PREFIX + "manager", fullName: "Manager", passwordHash: "x", role: "manager" }).returning({ id: users.id });
  admin = (await loadSessionUser(a.id))!;
  manager = (await loadSessionUser(m.id))!;
});
// Không đóng pool ở đây: các file test chạy chung một tiến trình và dùng chung pool của client.ts.
afterAll(cleanTestUsers);

describe("tài khoản", () => {
  test("tạo tài khoản trả mật khẩu một lần, đăng nhập được bằng mật khẩu đó", async () => {
    const r = await createUser(admin, form("new1", { permissions: ["schools"] }));
    if (!r.ok) throw new Error(r.message);
    expect(r.password).toMatch(/^[a-z2-9]{10}$/);
    expect((await attemptLogin(TEST_PREFIX + "new1", r.password)).ok).toBe(true);
    expect((await loadSessionUser(r.id))?.permissions).toEqual(["schools"]);
  });

  test("tên đăng nhập trùng bị từ chối", async () => {
    await createUser(admin, form("dup"));
    const r = await createUser(admin, form("dup"));
    expect(r).toMatchObject({ ok: false, field: "username" });
  });

  test("mã tài khoản để trống không chiếm unique", async () => {
    expect((await createUser(admin, form("blank1"))).ok).toBe(true);
    expect((await createUser(admin, form("blank2"))).ok).toBe(true);
  });

  test("Quản lý không gán vai Quản trị và không sửa tài khoản Quản trị", async () => {
    expect((await createUser(manager, form("mgr_admin", { role: "admin" }))).ok).toBe(false);
    expect((await updateUser(manager, admin.id, form("admin", { role: "admin" }))).ok).toBe(false);
    expect((await resetPassword(manager, admin.id)).ok).toBe(false);
    expect((await setActive(manager, admin.id, false)).ok).toBe(false);
  });

  test("không tự khoá và không tự đổi vai", async () => {
    expect((await setActive(admin, admin.id, false)).ok).toBe(false);
    expect((await updateUser(admin, admin.id, form("admin", { role: "manager" }))).ok).toBe(false);
  });

  test("sửa tài khoản ghi updated_at và thay bộ quyền", async () => {
    const r = await createUser(admin, form("edit", { permissions: ["schools"] }));
    if (!r.ok) throw new Error(r.message);
    const [before] = await db.select({ t: users.updatedAt }).from(users).where(eq(users.id, r.id));
    const u = await updateUser(admin, r.id, form("edit", { fullName: "Đã sửa", permissions: ["vouchers", "export_excel"] }));
    expect(u.ok).toBe(true);
    const after = await loadSessionUser(r.id);
    expect(after?.fullName).toBe("Đã sửa");
    expect(after?.permissions).toEqual(["export_excel", "vouchers"]);
    const [row] = await db.select({ t: users.updatedAt }).from(users).where(eq(users.id, r.id));
    expect(row.t.getTime()).toBeGreaterThan(before.t.getTime());
  });

  test("đặt lại mật khẩu xoá mọi phiên của người đó", async () => {
    const r = await createUser(admin, form("reset"));
    if (!r.ok) throw new Error(r.message);
    const { token } = await createSession(r.id);
    const reset = await resetPassword(admin, r.id);
    if (!reset.ok) throw new Error(reset.message);
    expect(await userFromToken(token)).toBeNull();
    expect((await attemptLogin(TEST_PREFIX + "reset", reset.password)).ok).toBe(true);
  });

  test("khoá tài khoản xoá phiên, mở khoá cho đăng nhập lại", async () => {
    const r = await createUser(admin, form("lockme"));
    if (!r.ok) throw new Error(r.message);
    const { token } = await createSession(r.id);
    expect((await setActive(admin, r.id, false)).ok).toBe(true);
    expect(await userFromToken(token)).toBeNull();
    expect((await attemptLogin(TEST_PREFIX + "lockme", r.password)).ok).toBe(false);
    expect((await setActive(admin, r.id, true)).ok).toBe(true);
    expect((await attemptLogin(TEST_PREFIX + "lockme", r.password)).ok).toBe(true);
  });

  test("mỗi thao tác ghi audit_log", async () => {
    const rows = await db.select({ action: auditLog.action }).from(auditLog).where(and(eq(auditLog.userId, admin.id)));
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ["create_user", "update_user", "reset_password", "lock_user", "unlock_user"]) expect(actions.has(a)).toBe(true);
  });

  test("danh sách tìm theo tên đăng nhập và phân trang 15 dòng", async () => {
    const page = await listUsers({ q: TEST_PREFIX + "new1", page: 1 });
    expect(page.rows.map((r) => r.username)).toEqual([TEST_PREFIX + "new1"]);
    expect(page.total).toBe(1);
    expect((await listUsers({ q: "", page: 1 })).rows.length).toBeLessThanOrEqual(15);
  });
});
