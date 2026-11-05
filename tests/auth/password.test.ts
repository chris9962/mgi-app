import { describe, expect, test } from "bun:test";
import { generatePassword, hashPassword, verifyPassword } from "../../src/server/auth/password";

describe("mật khẩu", () => {
  test("sinh 10 ký tự, bỏ ký tự dễ đọc nhầm", () => {
    for (let i = 0; i < 200; i++) expect(generatePassword()).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/);
  });

  test("mỗi lần sinh ra mật khẩu khác nhau", () => {
    expect(new Set(Array.from({ length: 50 }, generatePassword)).size).toBe(50);
  });

  test("băm bcrypt rồi kiểm lại được", async () => {
    const hash = await hashPassword("abc23xyz");
    expect(hash).toStartWith("$2");
    expect(await verifyPassword("abc23xyz", hash)).toBe(true);
    expect(await verifyPassword("abc23xyy", hash)).toBe(false);
  });
});
