import { describe, expect, test } from "bun:test";
import { joinCustomerRows } from "../../src/server/exportRows";

describe("ghép dòng ngân hàng và voucher vào hồ sơ khi xuất Excel", () => {
  test("ghép đúng theo id hồ sơ", () => {
    const rows = joinCustomerRows(
      [{ id: "a" }, { id: "b" }],
      [
        { customerId: "b", slot: 1 },
        { customerId: "a", slot: 2 },
        { customerId: "a", slot: 1 },
      ],
      [{ customerId: "a", code: "X" }],
    );
    expect(rows).toEqual([
      { id: "a", banks: [{ customerId: "a", slot: 2 }, { customerId: "a", slot: 1 }], voucher: { customerId: "a", code: "X" } },
      { id: "b", banks: [{ customerId: "b", slot: 1 }], voucher: null },
    ]);
  });

  test("20.000 hồ sơ ghép theo chỉ mục, không quét lại cả danh sách cho mỗi dòng", () => {
    const n = 20_000;
    const customers = Array.from({ length: n }, (_, i) => ({ id: `c${i}` }));
    const banks = customers.flatMap((c) => [
      { customerId: c.id, slot: 1 },
      { customerId: c.id, slot: 2 },
    ]);
    const codes = customers.map((c) => ({ customerId: c.id, code: c.id }));
    const started = performance.now();
    const rows = joinCustomerRows(customers, banks, codes);
    expect(performance.now() - started).toBeLessThan(500);
    expect(rows[n - 1]).toEqual({ id: `c${n - 1}`, banks: banks.slice(-2), voucher: codes[n - 1] });
  });
});
