import { inArray, like, or } from "drizzle-orm";

// Thiếu biến này thì pg tự nối localhost:5432, tức là một database khác.
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL chưa đặt. Chạy test DB bằng bun test:db.");

export const TEST_PREFIX = "zz_test_";
// Dữ liệu danh mục do test tạo mang tiền tố này để dọn được kể cả khi test hỏng giữa chừng.
export const TEST_NAME = "ZZTEST ";

export async function cleanTestUsers() {
  const { db } = await import("../../src/server/db/client");
  const s = await import("../../src/server/db/schema");
  const banks = (await db.select({ id: s.banks.id }).from(s.banks).where(like(s.banks.name, `${TEST_NAME}%`))).map((r) => r.id);
  const codes = (
    await db
      .select({ id: s.referralCodes.id })
      .from(s.referralCodes)
      .where(or(like(s.referralCodes.displayName, `${TEST_NAME}%`), banks.length ? inArray(s.referralCodes.bankId, banks) : undefined))
  ).map((r) => r.id);
  const schools = (await db.select({ id: s.schools.id }).from(s.schools).where(like(s.schools.name, `${TEST_NAME}%`))).map((r) => r.id);
  const testCustomers = schools.length ? (await db.select({ id: s.customers.id }).from(s.customers).where(inArray(s.customers.schoolId, schools))).map((r) => r.id) : [];
  if (testCustomers.length) {
    const rows = (await db.select({ id: s.customerBanks.id }).from(s.customerBanks).where(inArray(s.customerBanks.customerId, testCustomers))).map((r) => r.id);
    if (rows.length) await db.delete(s.reviewEvents).where(inArray(s.reviewEvents.customerBankId, rows));
    await db.delete(s.customerExistingBanks).where(inArray(s.customerExistingBanks.customerId, testCustomers));
    await db.delete(s.smsMessages).where(inArray(s.smsMessages.customerId, testCustomers));
    await db.delete(s.vouchers).where(inArray(s.vouchers.customerId, testCustomers));
    await db.delete(s.customerBanks).where(inArray(s.customerBanks.customerId, testCustomers));
  }
  if (codes.length) {
    await db.delete(s.customerBanks).where(inArray(s.customerBanks.referralCodeId, codes));
    await db.delete(s.referralCodeSchools).where(inArray(s.referralCodeSchools.referralCodeId, codes));
    await db.delete(s.referralCodeMonths).where(inArray(s.referralCodeMonths.referralCodeId, codes));
    await db.delete(s.referralCodes).where(inArray(s.referralCodes.id, codes));
  }
  if (schools.length) {
    await db.delete(s.customers).where(inArray(s.customers.schoolId, schools));
    await db.delete(s.schools).where(inArray(s.schools.id, schools));
  }
  if (banks.length) {
    await db.delete(s.userManagedBanks).where(inArray(s.userManagedBanks.bankId, banks));
    await db.delete(s.bankPhotoSlots).where(inArray(s.bankPhotoSlots.bankId, banks));
    await db.delete(s.banks).where(inArray(s.banks.id, banks));
  }
  await db.delete(s.settings).where(like(s.settings.key, "zz_test_%"));
  const ids = (await db.select({ id: s.users.id }).from(s.users).where(like(s.users.username, `${TEST_PREFIX}%`))).map((r) => r.id);
  if (ids.length) {
    await db.delete(s.auditLog).where(inArray(s.auditLog.userId, ids));
    await db.delete(s.users).where(inArray(s.users.id, ids));
  }
}

export async function makeActor(name: string, role: "admin" | "manager" | "staff", permissions: string[] = [], bankIds: string[] = []) {
  const { db } = await import("../../src/server/db/client");
  const { users, userManagedBanks, userPermissions } = await import("../../src/server/db/schema");
  const { loadSessionUser } = await import("../../src/server/auth/session");
  const [row] = await db.insert(users).values({ username: TEST_PREFIX + name, fullName: "Test " + name, passwordHash: "x", role }).returning({ id: users.id });
  if (permissions.length) await db.insert(userPermissions).values(permissions.map((p) => ({ userId: row.id, permission: p as "schools" })));
  if (bankIds.length) await db.insert(userManagedBanks).values(bankIds.map((bankId) => ({ userId: row.id, bankId })));
  return (await loadSessionUser(row.id))!;
}

// S3 là hệ ngoài: test DB dùng kho ảnh giả trong bộ nhớ, test S3 ghi ảnh thật. Kho giả nhận theo chữ ký file như putImage, không đổi WebP.
export const FAKE_WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, ...new Array(988).fill(7)]);
export function fakeStore() {
  const objects = new Map<string, number>();
  const removed: string[] = [];
  let puts = 0;
  const store = {
    put: async (bytes: Uint8Array): Promise<{ ok: true; key: string; size: number } | { ok: false; message: string }> => {
      const { imageExtOf, newKey } = await import("../../src/server/storage");
      puts += 1;
      if (!imageExtOf(bytes)) return { ok: false, message: "Chỉ nhận ảnh jpg, png, webp hoặc heic." };
      const key = newKey("proofs", "webp");
      objects.set(key, bytes.length);
      return { ok: true, key, size: bytes.length };
    },
    remove: async (key: string) => {
      objects.delete(key);
      removed.push(key);
    },
    signGet: async (key: string) => `https://s3.test/${key}?get`,
  };
  return { objects, removed, store, puts: () => puts };
}
