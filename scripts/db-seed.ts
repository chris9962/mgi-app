import { count } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { provinces, wards } from "../src/server/db/schema";
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

async function main() {
  console.log(await seedAddress());
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
