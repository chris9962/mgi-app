import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BANK_LOGOS, bankLogo } from "@/lib/bankLogos";

test("mỗi mã ngân hàng có logo trỏ tới file có thật trong public", () => {
  const missing = Object.values(BANK_LOGOS).filter((src) => !existsSync(join(import.meta.dir, "../../public", src)));
  expect(missing).toEqual([]);
});

test("hai mã của cùng một ngân hàng dùng chung logo, mã lạ không có logo", () => {
  expect(bankLogo("MSBA")).toBe(bankLogo("MSBB"));
  expect(bankLogo("VPA")).toBe(bankLogo("VPB"));
  expect(bankLogo("ZZVPB")).toBeNull();
});
