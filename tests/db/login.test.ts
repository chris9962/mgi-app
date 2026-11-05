import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { TEST_PREFIX, cleanTestUsers } from "./helpers";
import { db } from "../../src/server/db/client";
import { sessions, users } from "../../src/server/db/schema";
import { hashPassword } from "../../src/server/auth/password";
import { attemptLogin } from "../../src/server/auth/login";
import { SESSION_MAX_AGE_S, createSession, userFromToken } from "../../src/server/auth/session";

const PASSWORD = "dung23mk";

async function makeUser(name: string, active = true) {
  const [row] = await db
    .insert(users)
    .values({ username: TEST_PREFIX + name, fullName: "Test " + name, passwordHash: await hashPassword(PASSWORD), role: "staff", active })
    .returning({ id: users.id });
  return row.id;
}

beforeAll(cleanTestUsers);
// Không đóng pool ở đây: các file test chạy chung một tiến trình và dùng chung pool của client.ts.
afterAll(cleanTestUsers);

describe("đăng nhập", () => {
  test("sai 5 lần thì khoá, lần sau đúng mật khẩu vẫn bị khoá", async () => {
    await makeUser("lock");
    for (let i = 1; i <= 4; i++) expect((await attemptLogin(TEST_PREFIX + "lock", "sai")).code).toBe("bad_credentials");
    const fifth = await attemptLogin(TEST_PREFIX + "lock", "sai");
    expect(fifth.code).toBe("locked");
    const sixth = await attemptLogin(TEST_PREFIX + "lock", PASSWORD);
    expect(sixth.code).toBe("locked");
  });

  test("đúng mật khẩu trước khi khoá thì bộ đếm về 0", async () => {
    const id = await makeUser("reset");
    await attemptLogin(TEST_PREFIX + "reset", "sai");
    await attemptLogin(TEST_PREFIX + "reset", "sai");
    const ok = await attemptLogin(TEST_PREFIX + "reset", PASSWORD);
    expect(ok).toEqual({ ok: true, userId: id });
    const [row] = await db.select({ n: users.failedAttempts }).from(users).where(eq(users.id, id));
    expect(row.n).toBe(0);
  });

  test("tên đăng nhập không phân biệt hoa thường", async () => {
    await makeUser("case");
    expect((await attemptLogin(" " + (TEST_PREFIX + "CASE").toUpperCase(), PASSWORD)).ok).toBe(true);
  });

  test("tài khoản tắt và tên không có thật trả cùng lỗi với sai mật khẩu", async () => {
    await makeUser("off", false);
    const off = await attemptLogin(TEST_PREFIX + "off", PASSWORD);
    const none = await attemptLogin(TEST_PREFIX + "khongco", PASSWORD);
    const wrong = await attemptLogin(TEST_PREFIX + "case", "sai");
    expect(off).toEqual(none);
    expect(off.code).toBe("bad_credentials");
    expect(wrong.message).toBe(off.message);
  });
});

describe("đăng nhập cùng lúc", () => {
  test("10 request sai mật khẩu cùng lúc: đúng 4 lần báo sai, còn lại báo khoá, mật khẩu đúng sau đó vẫn bị khoá", async () => {
    const id = await makeUser("burst");
    const results = await Promise.all(Array.from({ length: 10 }, () => attemptLogin(TEST_PREFIX + "burst", "sai")));
    expect(results.filter((r) => r.code === "bad_credentials").length).toBe(4);
    expect(results.filter((r) => r.code === "locked").length).toBe(6);
    const [row] = await db.select({ lockedUntil: users.lockedUntil }).from(users).where(eq(users.id, id));
    expect(row.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect((await attemptLogin(TEST_PREFIX + "burst", PASSWORD)).code).toBe("locked");
  });
});

describe("phiên", () => {
  test("phiên dài 1 năm và đọc lại được người dùng", async () => {
    const id = await makeUser("session");
    const { token, expiresAt } = await createSession(id);
    expect(SESSION_MAX_AGE_S).toBe(365 * 24 * 60 * 60);
    expect(Math.abs(expiresAt.getTime() - Date.now() - SESSION_MAX_AGE_S * 1000)).toBeLessThan(5000);
    const user = await userFromToken(token);
    expect(user?.id).toBe(id);
    expect(user?.permissions).toEqual([]);
    expect(user?.managedBankIds).toEqual([]);
  });

  test("phiên hết hạn hoặc tài khoản tắt thì không đọc được", async () => {
    const id = await makeUser("expired");
    const { token } = await createSession(id);
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, id));
    expect(await userFromToken(token)).toBeNull();
    const { token: second } = await createSession(id);
    await db.update(users).set({ active: false }).where(eq(users.id, id));
    expect(await userFromToken(second)).toBeNull();
  });
});

describe("không lộ tên đăng nhập", () => {
  test("tên không có thật cũng bị báo khoá sau 5 lần, giống tên có thật", async () => {
    const name = TEST_PREFIX + "khong_ton_tai_" + Date.now();
    const results = [];
    for (let i = 0; i < 6; i++) results.push((await attemptLogin(name, "sai")).code);
    expect(results).toEqual(["bad_credentials", "bad_credentials", "bad_credentials", "bad_credentials", "locked", "locked"]);
  });

  test("Quản trị mở khoá thì tài khoản bị khoá tạm đăng nhập lại được", async () => {
    const { setActive } = await import("../../src/server/users");
    const { loadSessionUser } = await import("../../src/server/auth/session");
    const id = await makeUser("unlock");
    const [adminRow] = await db.insert(users).values({ username: TEST_PREFIX + "unlock_admin", fullName: "A", passwordHash: "x", role: "admin" }).returning({ id: users.id });
    for (let i = 0; i < 5; i++) await attemptLogin(TEST_PREFIX + "unlock", "sai");
    expect((await attemptLogin(TEST_PREFIX + "unlock", PASSWORD)).code).toBe("locked");
    expect((await setActive((await loadSessionUser(adminRow.id))!, id, true)).ok).toBe(true);
    expect((await attemptLogin(TEST_PREFIX + "unlock", PASSWORD)).ok).toBe(true);
  });
});
