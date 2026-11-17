// Ba sản phẩm bảo hiểm PVI ở màn Kết quả (feedback chủ dự án 2026-11-16). Link và hướng dẫn mua do Quản trị nhập ở trang Cài đặt.
export const INSURANCE_PRODUCTS = [
  { key: "student", name: "Bảo hiểm tai nạn học sinh" },
  { key: "moto", name: "Bảo hiểm xe máy" },
  { key: "electric", name: "Bảo hiểm tai nạn hộ sử dụng điện" },
] as const;

export type InsuranceKey = (typeof INSURANCE_PRODUCTS)[number]["key"];

export type StudentInsurance = { key: InsuranceKey; name: string; url: string; guide: string };

export const DEFAULT_THANKS_TEXT = "Cảm ơn các bạn tham gia chương trình khuyến học của tỉnh.";
