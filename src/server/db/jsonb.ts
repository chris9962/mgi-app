import { customType } from "drizzle-orm/pg-core";

// Postgres từ chối \u0000 và nửa cặp surrogate trong jsonb rồi trả lỗi 500, cột text thì tự đổi nửa cặp thành U+FFFD: đổi cả hai thành U+FFFD trước khi ghi.
const wellFormed = (_key: string, value: unknown) => (typeof value === "string" ? value.toWellFormed().replaceAll("\u0000", "\ufffd") : value);

// Như jsonb của drizzle, thêm bước đổi chuỗi: chuỗi lọt qua form ở audit_log, banks.guide, settings không thành lỗi 500.
export const jsonb = customType<{ data: unknown; driverData: unknown }>({
  dataType: () => "jsonb",
  toDriver: (value) => JSON.stringify(value, wellFormed),
  // Chép mapFromDriverValue của jsonb gốc: pg đã parse jsonb, chuỗi ở đây có thể là giá trị chuỗi của cột chứ không phải JSON.
  fromDriver: (value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  },
});
