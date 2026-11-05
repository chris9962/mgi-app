export const OPS_RESOURCE_PERCENT = 80;
export const OPS_PHOTO_CHECK_DAYS = 7;

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: digits }).format(value)} ${UNITS[unit]}`;
}

export const formatCount = (n: number): string => new Intl.NumberFormat("vi-VN").format(n);

// Mẫu số 0 nghĩa là chưa biết tổng (S3 chưa khai hạn mức): không có phần trăm để hiện.
export const resourcePercent = (used: number, total: number): number | null => (total > 0 ? Math.min(100, Math.round((used / total) * 100)) : null);
