// Cùng luật CONTROL của form học sinh: NUL làm Postgres báo lỗi 500, ký tự điều khiển khác không có chỗ trong ô một dòng.
const CONTROL = /[\u0000-\u001f\u007f]/;

export const noControlChar = (v: string) => !CONTROL.test(v);
export const CONTROL_CHAR_MESSAGE = "Có ký tự không hợp lệ";
