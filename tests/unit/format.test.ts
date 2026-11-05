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

describe("định dạng trên bảng", () => {
  test("ngày giờ ngắn dạng 03/11 09:48, ngày dạng 03/11/2026", async () => {
    const { formatShortDateTime, formatDate } = await import("../../src/lib/dates");
    expect(formatShortDateTime("2026-11-03T02:48:00Z")).toBe("03/11 09:48");
    expect(formatDate("2026-11-03T17:30:00Z")).toBe("04/11/2026");
  });
  test("SĐT tách 4-3-3", async () => {
    const { formatPhone } = await import("../../src/lib/text");
    expect(formatPhone("0987654321")).toBe("0987 654 321");
  });
});

describe("bỏ dấu", () => {
  test("chữ Đ tiếng Việt (U+0110) và Ð gõ nhầm từ bàn phím khác (U+00D0) đều thành D", async () => {
    const { removeDiacritics, plain } = await import("../../src/lib/text");
    const { nameInitials } = await import("../../src/server/voucher");
    expect(removeDiacritics("Đặng đức Ðạt ðình")).toBe("Dang duc Dat dinh");
    expect(plain("Ðặng Văn Lâm")).toBe("dang van lam");
    expect(nameInitials("Ðặng Văn Lâm")).toBe("DVL");
  });
});
