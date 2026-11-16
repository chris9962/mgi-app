import QRCode from "qrcode";
import { eq, inArray } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { bankPhotoSlots, banks, referralCodeSchools, referralCodes, schools, userManagedBanks, users } from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/password";
import { putImage } from "../src/server/storage";
import { bankScreen } from "../tests/support/bankScreen";
import guides from "./data/bank-guides.json";
import { VIDEO_CODES, VIDEO_DB, VIDEO_MANAGED_BANKS, VIDEO_PASSWORD, VIDEO_SCHOOL, VIDEO_USERS } from "./video-data";

// Chạy sau scripts/db-seed.ts (tỉnh, xã, 12 ngân hàng có logo) trên DB video vừa tạo lại.
// Chỉ ghi vào DB video: chạy nhầm vào DB local thì tên thật lẫn với dữ liệu đang làm.
async function main() {
  if (new URL(process.env.DATABASE_URL!).pathname !== `/${VIDEO_DB}`) throw new Error(`Seed video chỉ chạy trên DB ${VIDEO_DB}.`);
  const passwordHash = await hashPassword(VIDEO_PASSWORD);
  const userRows = await db
    .insert(users)
    .values(Object.values(VIDEO_USERS).map((u) => ({ ...u, passwordHash })))
    .returning({ id: users.id, username: users.username });
  const userId = (key: keyof typeof VIDEO_USERS) => userRows.find((u) => u.username === VIDEO_USERS[key].username)!.id;

  const bankRows = await db.select({ id: banks.id, code: banks.code }).from(banks).where(inArray(banks.code, guides.map((g) => g.code)));
  const bankId = (code: string) => bankRows.find((b) => b.code === code)!.id;

  // Hướng dẫn nguyên bản của mgst-app (chủ dự án chốt 2026-11-10). Ảnh mẫu thật có dữ liệu khách nên ảnh mẫu do code vẽ.
  for (const g of guides) {
    const sample = VIDEO_CODES.find((c) => c.bank === g.code);
    let sampleKey: string | null = null;
    if (sample) {
      const put = await putImage(await bankScreen({ name: "NGUYEN THI MAI", code: sample.code }), "samples");
      if (!put.ok) throw new Error(put.message);
      sampleKey = put.key;
    }
    await db.update(banks).set({ guide: g.guide }).where(eq(banks.id, bankId(g.code)));
    if (g.slots?.length) await db.insert(bankPhotoSlots).values(g.slots.map((s, i) => ({ bankId: bankId(g.code), name: s.name, sortOrder: i, checkName: s.checkName, checkCode: s.checkCode, sampleKey })));
  }

  for (const [key, codes] of Object.entries(VIDEO_MANAGED_BANKS)) await db.insert(userManagedBanks).values(codes.map((code) => ({ userId: userId(key as keyof typeof VIDEO_USERS), bankId: bankId(code) })));

  await db.insert(schools).values({ ...VIDEO_SCHOOL, createdBy: userId("admin") });
  for (const c of VIDEO_CODES) {
    const qr = await putImage(new Uint8Array(await QRCode.toBuffer(c.openUrl, { width: 400, margin: 2 })), "qr");
    if (!qr.ok) throw new Error(qr.message);
    const [code] = await db
      .insert(referralCodes)
      .values({ bankId: bankId(c.bank), displayName: c.displayName, code: c.code, qrKey: qr.key, openUrl: c.openUrl, monthlyQuota: 200, createdBy: userId("admin") })
      .returning({ id: referralCodes.id });
    await db.insert(referralCodeSchools).values({ referralCodeId: code.id, schoolId: VIDEO_SCHOOL.id });
  }
  console.log(`Seed video: ${userRows.length} tài khoản, hướng dẫn ${guides.length} ngân hàng, ${VIDEO_CODES.length} mã giới thiệu.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
