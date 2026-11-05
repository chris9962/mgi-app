import { expect, test } from "bun:test";
import { menuFor } from "../../src/components/shell/menu";
import type { SessionUser } from "../../src/lib/types";

const staff: SessionUser = { id: "u", username: "u", fullName: "U", role: "staff", title: "", phone: null, permissions: [], managedBankIds: ["b1"] };
const work = (user: SessionUser) => menuFor(user).find((g) => g.key === "work")?.items.map((i) => [i.href, i.label]);

test("nhóm Nghiệp vụ có trang Ngân hàng ngay dưới Hồ sơ học sinh, theo quyền hồ sơ", () => {
  expect(work(staff)).toEqual([
    ["/customers", "Hồ sơ học sinh"],
    ["/customer-banks", "Ngân hàng"],
  ]);
  expect(work({ ...staff, role: "manager", managedBankIds: [] })).toEqual(work(staff));
  expect(work({ ...staff, managedBankIds: [] })).toBeUndefined();
});
