const FORMAT = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// Máy chủ và điện thoại có thể đặt múi giờ khác nhau: luôn hiện giờ Việt Nam.
export function formatDateTime(value: Date | string): string {
  const parts = Object.fromEntries(FORMAT.formatToParts(new Date(value)).map((p) => [p.type, p.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}
