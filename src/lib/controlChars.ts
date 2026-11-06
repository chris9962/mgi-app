// Cùng luật CONTROL của form học sinh: NUL làm Postgres báo lỗi 500, ký tự điều khiển khác không có chỗ trong ô một dòng.
const CONTROL = /[\u0000-\u001f\u007f]/;
// Nửa cặp surrogate (emoji bị cắt đôi) làm cột jsonb báo lỗi 500. Cờ u chỉ khớp nửa đứng lẻ; không dùng isWellFormed() vì Firefox trước 119 chưa có.
const LONE_SURROGATE = /[\ud800-\udfff]/u;

export const wellFormed = (v: string) => !LONE_SURROGATE.test(v);
export const noControlChar = (v: string) => !CONTROL.test(v) && wellFormed(v);
export const CONTROL_CHAR_MESSAGE = "Có ký tự không hợp lệ";
