import { describe, expect, test } from "bun:test";
import { routeFor } from "../../src/lib/hosts";

const hosts = { admin: "admin.localhost", student: "bank.localhost" };

describe("routeFor", () => {
  test("tên miền quản lý vào thư mục admin", () => {
    expect(routeFor("admin.localhost:3100", "/users", hosts)).toEqual({ kind: "rewrite", path: "/admin/users" });
    expect(routeFor("ADMIN.localhost", "/", hosts)).toEqual({ kind: "rewrite", path: "/admin" });
  });

  test("tên miền học sinh vào thư mục student", () => {
    expect(routeFor("bank.localhost:3100", "/t/abc", hosts)).toEqual({ kind: "rewrite", path: "/student/t/abc" });
    expect(routeFor("bank.localhost", "/", hosts)).toEqual({ kind: "rewrite", path: "/student" });
  });

  test("API quản lý chỉ mở trên tên miền quản lý", () => {
    expect(routeFor("admin.localhost", "/api/admin/login", hosts)).toEqual({ kind: "next" });
    expect(routeFor("bank.localhost", "/api/admin/login", hosts)).toEqual({ kind: "notFound" });
  });

  test("API học sinh chỉ mở trên tên miền học sinh", () => {
    expect(routeFor("bank.localhost", "/api/customers/me", hosts)).toEqual({ kind: "next" });
    expect(routeFor("admin.localhost", "/api/customers/me", hosts)).toEqual({ kind: "notFound" });
  });

  test("gọi thẳng thư mục nội bộ trả 404", () => {
    expect(routeFor("admin.localhost", "/admin/users", hosts)).toEqual({ kind: "notFound" });
    expect(routeFor("bank.localhost", "/student/t/abc", hosts)).toEqual({ kind: "notFound" });
    expect(routeFor("bank.localhost", "/admin", hosts)).toEqual({ kind: "notFound" });
  });

  test("tên miền lạ trả 404", () => {
    expect(routeFor("evil.example", "/users", hosts)).toEqual({ kind: "notFound" });
    expect(routeFor(null, "/users", hosts)).toEqual({ kind: "notFound" });
  });
});

describe("matcher của proxy", () => {
  test("file tĩnh trong public đi thẳng, không qua proxy", async () => {
    const { config } = await import("../../src/proxy");
    const re = new RegExp(`^${config.matcher[0].replace("/((?!", "/(?!").replace(").*)", ").*")}$`);
    expect(re.test("/zxing_reader.wasm")).toBe(false);
    expect(re.test("/brand/logo.png")).toBe(false);
    expect(re.test("/_next/static/chunk.js")).toBe(false);
    expect(re.test("/users")).toBe(true);
    expect(re.test("/api/admin/images")).toBe(true);
    expect(re.test("/admin/users")).toBe(true);
  });
});
