import { sql, type AnyColumn, type SQL } from "drizzle-orm";
import { plain } from "@/lib/text";

// Postgres coi % và _ trong LIKE là ký tự đại diện; thoát bằng \ (ký tự thoát mặc định) để tìm đúng chữ đã gõ.
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// Ô chọn tìm đọc q thẳng từ URL; Postgres từ chối NUL trong chuỗi.
export const containsPattern = (s: string) => `%${escapeLike(s.replaceAll("\u0000", ""))}%`;

// Người dùng gõ SĐT theo cách đọc, có dấu cách hoặc dấu chấm.
export const phoneDigits = (q: string): string | null => {
  const d = q.replace(/[\s.]/g, "");
  return /^\d{3,10}$/.test(d) ? d : null;
};

// Cột chưa có bản bỏ dấu lưu sẵn: Postgres bỏ dấu bằng unaccent, máy chủ bỏ dấu từ khoá bằng plain, rồi so chuỗi con.
export const matchesPlain = (column: AnyColumn | SQL, term: string): SQL => sql`unaccent(lower(${column})) like ${containsPattern(plain(term).replace(/\s+/g, " "))}`;
