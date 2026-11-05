// Gom theo id hồ sơ trước khi ghép: lọc lại cả danh sách cho mỗi hồ sơ là O(n²), 20.000 dòng chặn máy chủ vài giây.
export function joinCustomerRows<R extends { id: string }, B extends { customerId: string }, V extends { customerId: string }>(rows: R[], banks: B[], vouchers: V[]) {
  const banksOf = new Map<string, B[]>();
  for (const b of banks) {
    const list = banksOf.get(b.customerId);
    if (list) list.push(b);
    else banksOf.set(b.customerId, [b]);
  }
  const voucherOf = new Map(vouchers.map((v) => [v.customerId, v]));
  return rows.map((r) => ({ ...r, banks: banksOf.get(r.id) ?? [], voucher: voucherOf.get(r.id) ?? null }));
}
