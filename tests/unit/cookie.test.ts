import { describe, expect, test } from "bun:test";
import { cookieSettings, sessionCookieHeader } from "../../src/server/auth/cookie";

describe("cookie phiên", () => {
  test("production chạy https: tên mang tiền tố __Host-, có Secure, Path=/, không Domain", () => {
    const s = cookieSettings({ NODE_ENV: "production" });
    expect(s).toEqual({ name: "__Host-mgi_session", secure: true });
    const header = sessionCookieHeader(s, "abc", 60);
    expect(header).toBe("__Host-mgi_session=abc; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=60");
    expect(header).not.toContain("Domain");
  });

  test("local chạy http: không Secure nên không dùng được tiền tố __Host-", () => {
    expect(cookieSettings({ NODE_ENV: "development" })).toEqual({ name: "mgi_session", secure: false });
    expect(sessionCookieHeader(cookieSettings({ NODE_ENV: "test" }), "", 0)).toBe("mgi_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
  });

  test("COOKIE_SECURE=false ở production (chưa có https) thì bỏ cả Secure lẫn tiền tố; COOKIE_SECURE=true thì bật cả hai", () => {
    expect(cookieSettings({ NODE_ENV: "production", COOKIE_SECURE: "false" })).toEqual({ name: "mgi_session", secure: false });
    expect(cookieSettings({ NODE_ENV: "development", COOKIE_SECURE: "true" })).toEqual({ name: "__Host-mgi_session", secure: true });
  });
});
