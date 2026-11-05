// Bỏ dấu để so khớp ô tìm: normalize("NFD") không tách chữ đ nên phải đổi riêng.
export const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export const maskPhone = (phone: string) => `${phone.slice(0, 4)} •••• ${phone.slice(-3)}`;

export const formatPhone = (phone: string) => (/^\d{10}$/.test(phone) ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}` : phone);
