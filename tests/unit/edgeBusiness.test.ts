import { describe, expect, test } from "bun:test";
import { parseCustomerFilters } from "../../src/lib/customerFilters";
import { parseCustomerBankFilters } from "../../src/lib/customerBankFilters";
import { parseSmsFilters } from "../../src/lib/smsFilters";
import { parseVoucherFilters } from "../../src/lib/voucherFilters";
import { containsPattern, SEARCH_MAX_LENGTH, searchTerms } from "../../src/server/search";

describe("tham số URL của trang nghiệp vụ", () => {
  test("ký tự NUL bị bỏ: Postgres từ chối NUL trong chuỗi và cột jsonb của audit", () => {
    expect(parseCustomerFilters({ q: "a\u0000b" }).q).toBe("ab");
    expect(parseCustomerBankFilters({ q: "\u0000anh\u0000" }).q).toBe("anh");
    expect(parseVoucherFilters({ q: "zz\u0000" }).q).toBe("zz");
    expect(parseSmsFilters({ q: "\u0000" }).q).toBe("");
    expect(containsPattern("a\u0000b")).toBe("%ab%");
  });

  test("ngày trước năm 1900 bị bỏ: 0001-01-01 lùi 7 giờ thành năm 0 mà Postgres không nhận", () => {
    for (const day of ["0001-01-01", "0000-01-01", "1899-12-31"]) expect([day, parseCustomerFilters({ from: day, to: day })]).toMatchObject([day, { from: "", to: "" }]);
    expect(parseVoucherFilters({ from: "1900-01-01", to: "9999-12-31" })).toMatchObject({ from: "1900-01-01", to: "9999-12-31" });
  });

  test("tháng 13, tháng 00, ngày 32 bị bỏ, không ném lỗi", () => {
    for (const day of ["2026-13-01", "2026-00-10", "2026-01-32", "2026-02-30"]) expect([day, parseCustomerFilters({ from: day, to: day })]).toMatchObject([day, { from: "", to: "" }]);
  });
});

describe("tách từ khoá như mgst-app", () => {
  test("bỏ dấu, viết thường, mỗi từ một phần, gộp khoảng trắng", () => {
    expect(searchTerms("  Nguyễn   THỊ Anh ")).toEqual(["nguyen", "thi", "anh"]);
    expect(searchTerms("   ")).toEqual([]);
  });

  test("cắt ở 100 ký tự rồi mới tách, tối đa 8 từ", () => {
    expect(searchTerms("a b c d e f g h i j")).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
    expect(searchTerms(`${"x".repeat(SEARCH_MAX_LENGTH)}yyy`)).toEqual(["x".repeat(SEARCH_MAX_LENGTH)]);
  });
});
