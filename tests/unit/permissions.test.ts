import { describe, expect, test } from "bun:test";
import { can, customerScope, ACTIONS } from "../../src/lib/permissions";
import type { SessionUser } from "../../src/lib/types";

const base: SessionUser = { id: "u", username: "u", fullName: "U", role: "staff", title: "", phone: null, permissions: [], managedBankIds: [] };
const admin = { ...base, role: "admin" as const };
const manager = { ...base, role: "manager" as const };
const staff = { ...base, permissions: ["schools" as const], managedBankIds: ["b1", "b2"] };

describe("can", () => {
  test("Quản trị có mọi quyền", () => {
    for (const a of ACTIONS) expect(can(admin, a)).toBe(true);
  });

  test("Quản lý có mọi quyền trừ màn Hệ thống", () => {
    for (const a of ACTIONS) expect(can(manager, a)).toBe(a !== "system");
  });

  test("Nhân viên chỉ có quyền được cấp, không có Phân quyền và Hệ thống", () => {
    expect(can(staff, "schools")).toBe(true);
    expect(can(staff, "manage_banks")).toBe(false);
    expect(can(staff, "export_excel")).toBe(false);
    expect(can(staff, "users")).toBe(false);
    expect(can(staff, "system")).toBe(false);
  });

  test("Nhân viên được giao ngân hàng thì vào được hồ sơ, chưa giao thì không", () => {
    expect(can(staff, "customers")).toBe(true);
    expect(can(base, "customers")).toBe(false);
  });
});

describe("customerScope", () => {
  test("Quản trị và Quản lý thấy toàn công ty", () => {
    expect(customerScope(admin)).toEqual({ all: true });
    expect(customerScope(manager)).toEqual({ all: true });
  });

  test("Nhân viên thấy hồ sơ có ngân hàng được giao", () => {
    expect(customerScope(staff)).toEqual({ all: false, bankIds: ["b1", "b2"] });
    expect(customerScope(base)).toEqual({ all: false, bankIds: [] });
  });
});
