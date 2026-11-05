import { describe, expect, test } from "bun:test";
import { formatDateTime } from "../../src/lib/dates";
import { maskPhone } from "../../src/lib/text";

describe("ngày giờ theo giờ Việt Nam", () => {
  test("dạng 03/11/2026 09:48", () => {
    expect(formatDateTime("2026-11-03T02:48:00Z")).toBe("03/11/2026 09:48");
  });
  test("18 giờ UTC là sáng hôm sau ở Việt Nam", () => {
    expect(formatDateTime(new Date("2026-11-04T18:05:00Z"))).toBe("05/11/2026 01:05");
  });
});

describe("che SĐT phụ huynh", () => {
  test("giữ 4 số đầu, 3 số cuối", () => expect(maskPhone("0987654321")).toBe("0987 •••• 321"));
});
