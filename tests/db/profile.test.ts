import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TEST_PREFIX, cleanTestUsers } from "./helpers";
import { db } from "../../src/server/db/client";
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
});
