import { and, count, eq, isNull } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { banks, provinces, wards } from "../src/server/db/schema";
import bankList from "./data/banks.json";
import vnAddress from "./data/vnAddress.json";

// Danh mục 34 tỉnh, 3.321 xã sau sáp nhập 2025, chép từ mgst-app. Chỉ nạp khi bảng tỉnh còn rỗng.
async function seedAddress(): Promise<string> {
  const [{ n }] = await db.select({ n: count() }).from(provinces);
  if (n > 0) return `Bỏ qua tỉnh, xã: bảng provinces đã có ${n} dòng.`;

  // Một transaction: gãy giữa chừng thì không còn bảng tỉnh đủ mà bảng xã thiếu.
  await db.transaction(async (tx) => {
    await tx.insert(provinces).values(vnAddress.provinces.map((p) => ({ code: p.id, name: p.name })));
    // File nguồn có tên xã lẫn ký tự xuống dòng, chuẩn hoá lúc nạp thay vì sửa file.
    const rows = vnAddress.wards.map((w) => ({
      code: w.id,
      provinceCode: w.provinceId,
      name: w.name.replace(/\s+/g, " ").trim(),
    }));
    for (let i = 0; i < rows.length; i += 500) await tx.insert(wards).values(rows.slice(i, i + 500));
  });
  return `Nạp ${vnAddress.provinces.length} tỉnh, ${vnAddress.wards.length} xã.`;
}

// 12 ngân hàng chép từ mgst-app 2026-11-05, logo từ bộ logo VietQR. Ngân hàng đã có thì chỉ điền logo còn trống, không đè tên, thứ tự, trạng thái Quản trị đã sửa.
async function seedBanks(): Promise<string> {
  const added = await db.insert(banks).values(bankList).onConflictDoNothing({ target: banks.code }).returning({ code: banks.code });
  let filled = 0;
  for (const b of bankList) {
    const rows = await db.update(banks).set({ logo: b.logo }).where(and(eq(banks.code, b.code), isNull(banks.logo))).returning({ id: banks.id });
    filled += rows.length;
  }
  return `Thêm ${added.length} ngân hàng, điền logo cho ${filled} ngân hàng đã có.`;
}

async function main() {
  console.log(await seedAddress());
  console.log(await seedBanks());
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
