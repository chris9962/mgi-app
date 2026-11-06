import { describe, expect, test } from "bun:test";
import { currentYearMonth, isYearMonth, monthLabel, shiftMonth } from "../../src/lib/month";

describe("tháng", () => {
  test("17:30 UTC ngày 31/10 đã là tháng 11 ở Việt Nam", () => {
    expect(currentYearMonth(new Date("2026-10-31T17:30:00Z"))).toBe("2026-11");
    expect(currentYearMonth(new Date("2026-10-31T16:59:00Z"))).toBe("2026-10");
  });
  test("lùi, tiến tháng qua năm", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
  test("kiểm dạng tháng và nhãn", () => {
    expect(isYearMonth("2026-11")).toBe(true);
    expect(isYearMonth("2026-13")).toBe(false);
    expect(isYearMonth("1900-01")).toBe(true);
    for (const v of ["0001-01", "0099-12", "1899-12"]) expect([v, isYearMonth(v)]).toEqual([v, false]);
    expect(monthLabel("2026-11")).toBe("Tháng 11/2026");
  });
});
