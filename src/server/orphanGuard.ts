// Ảnh mồ côi thật chỉ đến từ transaction lỗi nên rất ít. Nhiều ảnh cùng lúc không dòng nào trỏ tới thường nghĩa là DB sai
// (tạo lại rỗng, khôi phục nhầm bản, nối nhầm DB): xoá theo DB đó là mất ảnh thật, nên dừng và báo người vận hành.
const MAX_SHARE = 0.1;
const MIN_ORPHANS = 20;

export function orphanGuard(s: { candidates: number; orphans: number; dbRows: number }): string | null {
  if (s.orphans > 0 && s.dbRows === 0) return `DB không có dòng proof_photos nào mà bucket có ${s.orphans} ảnh cũ: nghi DB rỗng hoặc khôi phục sai.`;
  if (s.orphans > MIN_ORPHANS && s.orphans / s.candidates > MAX_SHARE)
    return `${s.orphans} trên ${s.candidates} ảnh cũ (${Math.round((s.orphans / s.candidates) * 100)}%) không dòng nào trỏ tới, vượt ngưỡng ${MAX_SHARE * 100}%: nghi DB sai.`;
  return null;
}
