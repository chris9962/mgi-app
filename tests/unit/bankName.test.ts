import { expect, test } from "bun:test";
import { shortName, splitBankName } from "../../src/lib/bankName";

test("tên ngắn lấy trong ngoặc cuối, không có ngoặc thì giữ nguyên", () => {
  expect(splitBankName("Ngân hàng TMCP Quân đội (MB Bank)")).toEqual({ short: "MB Bank", long: "Ngân hàng TMCP Quân đội" });
  expect(splitBankName("Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank NEO)")).toEqual({ short: "VPBank NEO", long: "Ngân hàng TMCP Việt Nam Thịnh Vượng" });
  expect(splitBankName("Ngân hàng TMCP Hàng Hải Việt Nam (MSB b)")).toEqual({ short: "MSB b", long: "Ngân hàng TMCP Hàng Hải Việt Nam" });
  expect(splitBankName("ZZE2E HS VPBank")).toEqual({ short: "ZZE2E HS VPBank", long: null });
  // Ngoặc ở giữa tên không phải tên ngắn.
  expect(shortName("MB (a) Quân đội")).toBe("MB (a) Quân đội");
  expect(shortName("Ngân hàng (x) (MB)")).toBe("MB");
});
