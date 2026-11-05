import { db, pool } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/password";
import { cleanE2e, E2E_PASSWORD, E2E_PREFIX } from "./e2e-clean";

// Tài khoản test mang tiền tố zz_e2e_ để script dọn xoá được kể cả khi test hỏng giữa chừng. Chỉ chạy trên DB local.
async function main() {
  await cleanE2e();
  const passwordHash = await hashPassword(E2E_PASSWORD);
  await db.insert(users).values([
    { username: `${E2E_PREFIX}admin`, fullName: "E2E Quản trị", role: "admin", passwordHash },
    { username: `${E2E_PREFIX}staff`, fullName: "E2E Nhân viên", role: "staff", passwordHash },
    { username: `${E2E_PREFIX}lock`, fullName: "E2E Khoá", role: "staff", passwordHash },
  ]);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
