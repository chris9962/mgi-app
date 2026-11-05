const FORMAT = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// Máy chủ và điện thoại có thể đặt múi giờ khác nhau: luôn hiện giờ Việt Nam.
export function formatDateTime(value: Date | string): string {
  const parts = Object.fromEntries(FORMAT.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

const parts = (value: Date | string) => Object.fromEntries(FORMAT.formatToParts(new Date(value)).map((p) => [p.type, p.value]));

// Bảng danh sách hiện ngày tháng và giờ, bỏ năm cho gọn cột.
export function formatShortDateTime(value: Date | string): string {
  const p = parts(value);
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

export function formatDate(value: Date | string): string {
  const p = parts(value);
  return `${p.day}/${p.month}/${p.year}`;
}
