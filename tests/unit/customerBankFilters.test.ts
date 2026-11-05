import { describe, expect, test } from "bun:test";
import { customerBankFilterQuery, parseCustomerBankFilters } from "../../src/lib/customerBankFilters";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("bộ lọc trang Ngân hàng trên URL", () => {
  test("giá trị lạ bị bỏ, giá trị đúng giữ nguyên", () => {
    expect(parseCustomerBankFilters({ q: " anh ", from: "2026-11-01", to: "2026-11-04", bank: `${A},${B}`, status: "passed", check: "full", school: A, dir: "asc" })).toEqual({
      q: "anh",
      from: "2026-11-01",
      to: "2026-11-04",
      bank: [A, B],
      status: "passed",
      check: "full",
      school: [A],
      dir: "asc",
    });
    expect(parseCustomerBankFilters({ from: "2026-02-30", bank: `x,${A},${A}`, status: "done", check: "x", school: "1", dir: "up" })).toEqual({
      q: "",
      from: "",
      to: "",
      bank: [A],
      status: "",
      check: "",
      school: [],
      dir: "desc",
    });
  });

  test("chuỗi query chỉ ghi bộ lọc đang bật, mới nhất trước thì không ghi chiều sắp", () => {
    const f = parseCustomerBankFilters({ bank: `${A},${B}`, status: "pending" });
    expect(customerBankFilterQuery(f, { page: "2" })).toBe(`bank=${A}%2C${B}&status=pending&page=2`);
    expect(customerBankFilterQuery({ ...f, bank: [], status: "", dir: "asc" })).toBe("dir=asc");
  });
});
