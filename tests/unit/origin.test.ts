import { describe, expect, test } from "bun:test";
import { sameOrigin } from "../../src/lib/hosts";

const req = (method: string, headers: Record<string, string>) => new Request("http://admin.localhost:3100/api/admin/users", { method, headers });

describe("sameOrigin", () => {
  test("GET luôn qua", () => expect(sameOrigin(req("GET", {}), "admin.localhost")).toBe(true));
  test("POST từ chính trang quản lý thì qua", () => expect(sameOrigin(req("POST", { origin: "http://admin.localhost:3100" }), "admin.localhost")).toBe(true));
  test("POST từ web học sinh bị chặn", () => expect(sameOrigin(req("POST", { origin: "http://bank.localhost:3100" }), "admin.localhost")).toBe(false));
  test("POST không có Origin và không có Sec-Fetch-Site bị chặn", () => expect(sameOrigin(req("POST", {}), "admin.localhost")).toBe(false));
  test("POST không có Origin nhưng Sec-Fetch-Site là same-origin thì qua", () =>
    expect(sameOrigin(req("POST", { "sec-fetch-site": "same-origin" }), "admin.localhost")).toBe(true));
  test("Origin rác bị chặn", () => expect(sameOrigin(req("POST", { origin: "null" }), "admin.localhost")).toBe(false));
});
