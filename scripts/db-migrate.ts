import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL chưa đặt. Tạo .env.local từ .env.example rồi chạy lại.");

  const pool = new Pool({ connectionString });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("Migrate xong.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
