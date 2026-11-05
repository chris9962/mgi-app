import { inArray, like } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { auditLog, users } from "../src/server/db/schema";

export const E2E_PREFIX = "zz_e2e_";
export const E2E_PASSWORD = "e2e23test";

export async function cleanE2e() {
  const ids = (await db.select({ id: users.id }).from(users).where(like(users.username, `${E2E_PREFIX}%`))).map((r) => r.id);
  if (!ids.length) return;
  await db.delete(auditLog).where(inArray(auditLog.userId, ids));
  await db.delete(users).where(inArray(users.id, ids));
}

if (import.meta.main) {
  cleanE2e()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
