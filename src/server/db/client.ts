import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Cache lên globalThis vì `next dev` nạp lại module liên tục, mỗi lần nạp mà tạo pool mới thì cạn kết nối.
const globalForDb = globalThis as unknown as { mgiBankPool?: Pool };

// Thiếu biến này thì `pg` không báo lỗi mà tự nối localhost:5432, tức là một database khác.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL chưa đặt. Tạo .env.local từ .env.example rồi chạy lại.");

const pool = globalForDb.mgiBankPool ?? new Pool({ connectionString, max: 10 });

if (!globalForDb.mgiBankPool) {
  // Không có listener thì lỗi của kết nối nhàn rỗi làm chết cả tiến trình Next.
  pool.on("error", (err) => console.error("[db] kết nối nhàn rỗi gặp lỗi:", err));
}

if (process.env.NODE_ENV !== "production") globalForDb.mgiBankPool = pool;

export const db = drizzle(pool, { schema });
export { pool };
