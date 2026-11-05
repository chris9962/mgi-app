import { describe, expect, test } from "bun:test";
import { customerFilterQuery, dayRange, parseCustomerFilters } from "../../src/lib/customerFilters";

describe("bộ lọc hồ sơ trên URL", () => {
  test("giá trị lạ bị bỏ, giá trị đúng giữ nguyên", () => {
    expect(parseCustomerFilters({ q: " anh ", status: "pending_review", from: "2026-11-01", to: "2026-11-04", passed: "2", check: "missing" })).toEqual({
      q: "anh",
      status: "pending_review",
      from: "2026-11-01",
      to: "2026-11-04",
      passed: "2",
      check: "missing",
    });
    expect(parseCustomerFilters({ status: "deleted", from: "2026-02-30", to: "04/11/2026", passed: "3", check: "x" })).toEqual({ q: "", status: "", from: "", to: "", passed: "", check: "" });
  });

  test("nhận URLSearchParams và mảng giá trị", () => {
    expect(parseCustomerFilters(new URLSearchParams("status=reviewed&q=nam")).status).toBe("reviewed");
    expect(parseCustomerFilters({ status: ["new", "reviewed"] }).status).toBe("new");
  });

  test("chuỗi query chỉ ghi bộ lọc đang bật", () => {
    expect(customerFilterQuery({ q: "anh", status: "", from: "2026-11-01", to: "", passed: "", check: "" }, { page: "2" })).toBe("q=anh&from=2026-11-01&page=2");
  });

  test("ngày tính theo giờ Việt Nam", () => {
    expect(dayRange("2026-11-04", "2026-11-04")).toEqual({ start: new Date("2026-11-03T17:00:00Z"), end: new Date("2026-11-04T17:00:00Z") });
    expect(dayRange("", "")).toEqual({ start: null, end: null });
  });
});
