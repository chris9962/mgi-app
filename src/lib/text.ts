// Bỏ dấu để so khớp ô tìm: normalize("NFD") không tách chữ đ nên phải đổi riêng.
export const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
