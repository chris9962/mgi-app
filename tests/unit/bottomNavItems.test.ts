import { expect, test } from "bun:test";
import { bottomNavItems } from "../../src/components/shell/bottomNavItems";
import { menuFor } from "../../src/components/shell/menu";
import type { SessionUser } from "../../src/lib/types";

const staff: SessionUser = { id: "u", username: "u", fullName: "U", role: "staff", title: "", phone: null, permissions: [], managedBankIds: [] };
const items = (user: SessionUser) => bottomNavItems(menuFor(user)).map((i) => [i.href, i.label]);

test("thanh đáy có đủ 3 trang nghiệp vụ theo thứ tự cố định khi có quyền", () => {
  const all = [
    ["/customers", "Hồ sơ học sinh"],
    ["/customer-banks", "Ngân hàng"],
    ["/vouchers", "Mã voucher"],
  ];
  expect(items({ ...staff, role: "admin" })).toEqual(all);
  expect(items({ ...staff, role: "manager" })).toEqual(all);
  expect(items({ ...staff, managedBankIds: ["b1"], permissions: ["vouchers"] })).toEqual(all);
});

test("thanh đáy chỉ có trang người dùng có quyền", () => {
  expect(items({ ...staff, managedBankIds: ["b1"] })).toEqual([
    ["/customers", "Hồ sơ học sinh"],
    ["/customer-banks", "Ngân hàng"],
  ]);
  expect(items({ ...staff, permissions: ["vouchers"] })).toEqual([["/vouchers", "Mã voucher"]]);
  expect(items({ ...staff, permissions: ["schools", "manage_banks"] })).toEqual([]);
  expect(items(staff)).toEqual([]);
});
