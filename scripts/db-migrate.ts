import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

// DATABASE_URL đặt trong shell thắng .env.local: in database đang nối để người chạy thấy ngay mình migrate nhầm chỗ.
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL chưa đặt. Tạo .env.local từ .env.example rồi chạy lại.");
  const url = new URL(connectionString);
  console.log(`Database: ${url.hostname}:${url.port || "5432"}${url.pathname}`);

  const pool = new Pool({ connectionString });
  // Database mới chưa có bảng migration: Postgres báo lỗi ngay khi câu đếm nhắc tới bảng đó, nên hỏi bảng có chưa trước.
  const applied = async () => {
    const exists = (await pool.query<{ t: string | null }>("select to_regclass('drizzle.__drizzle_migrations') as t")).rows[0].t;
    return exists ? Number((await pool.query<{ n: string }>("select count(*) as n from drizzle.__drizzle_migrations")).rows[0].n) : 0;
  };
  const before = await applied();
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  const after = await applied();
  await pool.end();
  console.log(`Migrate xong: ${after - before} migration mới, tổng ${after}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
