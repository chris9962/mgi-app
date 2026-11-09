import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import bankList from "../../scripts/data/banks.json";

test("logo của danh sách ngân hàng seed trỏ tới file có thật trong scripts/data/bank-logos", () => {
  const missing = bankList.filter((b) => !existsSync(join(import.meta.dir, "../../scripts/data/bank-logos", b.logo))).map((b) => b.code);
  expect(missing).toEqual([]);
});

test("mã ngân hàng trong danh sách seed không trùng", () => {
  expect(new Set(bankList.map((b) => b.code)).size).toBe(bankList.length);
});
