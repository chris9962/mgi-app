import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TEST_PREFIX, cleanTestUsers } from "./helpers";
import { db } from "../../src/server/db/client";
import { eq } from "drizzle-orm";
import { users } from "../../src/server/db/schema";
import { attemptLogin } from "../../src/server/auth/login";
import { hashPassword } from "../../src/server/auth/password";
import { createSession, hashToken, loadSessionUser, userFromToken } from "../../src/server/auth/session";
import { changeOwnPassword, updateOwnInfo } from "../../src/server/profile";
import type { SessionUser } from "../../src/lib/types";

let me: SessionUser;

beforeAll(async () => {
  await cleanTestUsers();
  const [row] = await db
    .insert(users)
    .values({ username: TEST_PREFIX + "me", fullName: "Tôi", passwordHash: await hashPassword("cu23abc"), role: "staff" })
    .returning({ id: users.id });
  me = (await loadSessionUser(row.id))!;
});
afterAll(cleanTestUsers);

describe("cá nhân", () => {
  test("sai mật khẩu hiện tại thì báo lỗi ở ô đó", async () => {
    const r = await changeOwnPassword(me, null, { currentPassword: "sai", newPassword: "moi23abc", confirmPassword: "moi23abc" });
    expect(r).toMatchObject({ ok: false, field: "currentPassword" });
  });

  test("đổi xong thì xoá phiên khác, giữ phiên đang dùng", async () => {
    const current = await createSession(me.id);
    const other = await createSession(me.id);
    const r = await changeOwnPassword(me, hashToken(current.token), { currentPassword: "cu23abc", newPassword: "moi23abc", confirmPassword: "moi23abc" });
    expect(r.ok).toBe(true);
    expect((await userFromToken(current.token))?.id).toBe(me.id);
    expect(await userFromToken(other.token)).toBeNull();
    expect((await attemptLogin(TEST_PREFIX + "me", "moi23abc")).ok).toBe(true);
  });

  test("sửa họ tên và số điện thoại của chính mình", async () => {
    expect((await updateOwnInfo(me, { fullName: "Tên mới", phone: "0903456789" })).ok).toBe(true);
    const after = await loadSessionUser(me.id);
    expect(after?.fullName).toBe("Tên mới");
    expect(after?.phone).toBe("0903456789");
  });

  test("sai mật khẩu hiện tại 5 lần liên tiếp thì khoá 15 phút như đăng nhập: mật khẩu đúng cũng bị từ chối, đăng nhập cũng bị khoá", async () => {
    const [row] = await db.insert(users).values({ username: TEST_PREFIX + "me_lock", fullName: "Khoá", passwordHash: await hashPassword("dung23abc"), role: "staff" }).returning({ id: users.id });
    const actor = (await loadSessionUser(row.id))!;
    const change = (currentPassword: string) => changeOwnPassword(actor, null, { currentPassword, newPassword: "moi23abc", confirmPassword: "moi23abc" });
    for (let i = 1; i <= 4; i++) expect(await change("sai")).toMatchObject({ ok: false, field: "currentPassword", status: 400 });
    const fifth = await change("sai");
    expect(fifth).toMatchObject({ ok: false, status: 423 });
    expect(fifth.ok ? "" : fifth.message).toContain("khoá 15 phút");
    expect(await change("dung23abc")).toMatchObject({ ok: false, status: 423 });
    expect((await attemptLogin(TEST_PREFIX + "me_lock", "dung23abc")).ok).toBe(false);
  });

  test("nhập đúng mật khẩu hiện tại thì xoá số lần sai trước đó", async () => {
    const [row] = await db.insert(users).values({ username: TEST_PREFIX + "me_reset", fullName: "Đếm", passwordHash: await hashPassword("dung23abc"), role: "staff" }).returning({ id: users.id });
    const actor = (await loadSessionUser(row.id))!;
    for (let i = 0; i < 3; i++) await changeOwnPassword(actor, null, { currentPassword: "sai", newPassword: "moi23abc", confirmPassword: "moi23abc" });
    expect((await changeOwnPassword(actor, null, { currentPassword: "dung23abc", newPassword: "moi23abc", confirmPassword: "moi23abc" })).ok).toBe(true);
    const [after] = await db.select({ n: users.failedAttempts, until: users.lockedUntil }).from(users).where(eq(users.id, row.id));
    expect(after).toEqual({ n: 0, until: null });
  });
});
