// normalize("NFD") không tách chữ đ nên phải đổi riêng; Ð, ð (U+00D0, U+00F0) trông giống Đ, đ và hay lọt vào khi gõ từ bàn phím khác.
export const removeDiacritics = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đð]/g, "d")
    .replace(/[ĐÐ]/g, "D");

// Bỏ dấu, viết thường để so khớp ô tìm.
export const plain = (s: string) => removeDiacritics(s).toLowerCase();

// Tên trong SMS và file Excel: VIẾT HOA, BỎ DẤU như mgst-app.
export const nameForExcel = (name: string) => removeDiacritics(name).toUpperCase();

export const maskPhone = (phone: string) => `${phone.slice(0, 4)} •••• ${phone.slice(-3)}`;

export const formatPhone = (phone: string) => (/^\d{10}$/.test(phone) ? `${phone.slice(0, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}` : phone);
