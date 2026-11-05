import { parseArgs } from "node:util";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { users } from "../src/server/db/schema";
import { generatePassword, hashPassword } from "../src/server/auth/password";

// bun db:create-admin -- --username admin --full-name "Quản trị"
async function main() {
  const { values } = parseArgs({ options: { username: { type: "string" }, "full-name": { type: "string" } } });
  const username = values.username?.trim().toLowerCase();
  const fullName = values["full-name"]?.trim();
  if (!username || !fullName) throw new Error('Thiếu tham số. Dùng: bun db:create-admin -- --username admin --full-name "Quản trị"');

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  if (existing) throw new Error(`Tên đăng nhập ${username} đã có. Script không ghi đè tài khoản cũ.`);

  const password = generatePassword();
  await db.insert(users).values({ username, fullName, passwordHash: await hashPassword(password), role: "admin", title: "Quản trị" });
  console.log(`Đã tạo Quản trị ${username}. Mật khẩu: ${password}`);
  console.log("Mật khẩu chỉ in một lần. Lưu lại ngay.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
