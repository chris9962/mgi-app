// Tháng tính theo giờ Việt Nam: máy chủ chạy UTC, nửa đêm đầu tháng ở Việt Nam vẫn là tháng trước theo UTC.
export function currentYearMonth(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}

// Bỏ tháng trước 1900 như readDay: Date.UTC đọc năm dưới 100 thành 19xx, Tháng sau của 0001-01 ra 1901-02.
export const isYearMonth = (v: string) => /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(v) && v >= "1900-01";

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export const monthLabel = (ym: string) => `Tháng ${ym.slice(5)}/${ym.slice(0, 4)}`;
