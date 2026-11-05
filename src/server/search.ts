// Postgres coi % và _ trong LIKE là ký tự đại diện; thoát bằng \ (ký tự thoát mặc định) để tìm đúng chữ đã gõ.
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export const containsPattern = (s: string) => `%${escapeLike(s)}%`;

// Người dùng gõ SĐT theo cách đọc, có dấu cách hoặc dấu chấm.
export const phoneDigits = (q: string): string | null => {
  const d = q.replace(/[\s.]/g, "");
  return /^\d{3,10}$/.test(d) ? d : null;
};
