import { inArray, like } from "drizzle-orm";

// Thiếu biến này thì pg tự nối localhost:5432, tức là một database khác.
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL chưa đặt. Chạy test DB bằng bun test:db.");

export const TEST_PREFIX = "zz_test_";

export async function cleanTestUsers() {
  const { db } = await import("../../src/server/db/client");
  const { users, auditLog } = await import("../../src/server/db/schema");
  const ids = (await db.select({ id: users.id }).from(users).where(like(users.username, `${TEST_PREFIX}%`))).map((r) => r.id);
  if (ids.length) {
    await db.delete(auditLog).where(inArray(auditLog.userId, ids));
    await db.delete(users).where(inArray(users.id, ids));
  }
}
