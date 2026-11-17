import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { banks, provinces, wards } from "../src/server/db/schema";
import { putImage } from "../src/server/storage";
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

// 12 ngân hàng chép từ mgst-app 2026-11-05, logo từ bộ logo VietQR. Ngân hàng đã có thì không đè tên, thứ tự, trạng thái Quản trị đã sửa.
async function seedBanks(): Promise<string> {
  const rows = bankList.map((b) => ({ code: b.code, name: b.name, sortOrder: b.sortOrder, active: b.active, hotline: b.hotline }));
  const added = await db.insert(banks).values(rows).onConflictDoNothing({ target: banks.code }).returning({ code: banks.code });
  // Logo ở đây chỉ để khởi đầu: ngân hàng đã có logo do Quản trị tải lên thì giữ nguyên.
  const missing = await db.select({ code: banks.code }).from(banks).where(and(inArray(banks.code, bankList.map((b) => b.code)), isNull(banks.logoKey)));
  for (const { code } of missing) {
    const file = bankList.find((b) => b.code === code)!.logo;
    const put = await putImage(new Uint8Array(readFileSync(join(import.meta.dir, "data/bank-logos", file))), "logos");
    if (!put.ok) throw new Error(`Logo ${code}: ${put.message}`);
    await db.update(banks).set({ logoKey: put.key }).where(and(eq(banks.code, code), isNull(banks.logoKey)));
  }
  // Số tổng đài chỉ điền khi còn trống: Quản trị đã sửa thì giữ.
  for (const b of bankList) await db.update(banks).set({ hotline: b.hotline }).where(and(eq(banks.code, b.code), isNull(banks.hotline)));
  return `Thêm ${added.length} ngân hàng, tải logo cho ${missing.length} ngân hàng.`;
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
