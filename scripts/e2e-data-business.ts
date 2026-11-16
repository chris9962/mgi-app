// Hằng của dữ liệu e2e nhóm nghiệp vụ, dùng chung cho seed và file spec; file này không nối DB để Playwright import được.
const id = (n: number) => `e2e0b000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Cắt đúng độ dài tối đa của form; chuỗi cắt rơi vào dấu cách thì đổi ký tự cuối để không bị trim mất.
const exactly = (text: string, length: number) => {
  const cut = text.repeat(Math.ceil(length / text.length)).slice(0, length);
  return cut.endsWith(" ") ? `${cut.slice(0, -1)}X` : cut;
};

export const B_SCHOOL_ID = id(1);
export const B_SCHOOL = "ZZE2E THPT Biên Nghiệp Vụ Có Tên Trường Rất Dài Để Thử Bảng Hộp Thoại Và Chip Lọc Trên Điện Thoại";
export const B_SCHOOL2_ID = id(2);
export const B_SCHOOL2 = "ZZE2E THPT Biên Hai";

export const B_BANK1_ID = id(101);
export const B_BANK1 = "ZZE2E Biên Ngân hàng Thương mại Cổ phần Có Tên Rất Dài Chi Nhánh Thành Phố Hồ Chí Minh";
export const B_BANK2_ID = id(102);
export const B_BANK2 = "ZZE2E Biên Ngân hàng Hai";
export const B_BANK3_ID = id(103);
export const B_BANK3 = "ZZE2E Biên Ngân hàng Trống";

export const B_USER1 = "zz_e2e_bien1";
export const B_USER2 = "zz_e2e_bien2";
export const B_USER3 = "zz_e2e_bien3";
export const B_USER4 = "zz_e2e_bien4";

export const B_PAGE_COUNT = 16;
export const bPageName = (n: number) => `Biên Phân Trang ${String(n).padStart(2, "0")}`;
export const bPageId = (n: number) => id(300 + n);
export const bPhone = (n: number) => `0966${String(n).padStart(6, "0")}`;
export const bParentPhone = (n: number) => `0988${String(n).padStart(6, "0")}`;
export const bPageVoucher = (n: number) => `ZZBIEN-BPT${String(n).padStart(2, "0")}-10A1-K7Q2`;

// 17 hồ sơ chờ kiểm tra cho ca Đạt dòng cuối của trang cuối rồi bấm Quay lại. A chỉ có ngân hàng 2, Q tạo ngày 14/10, B tới P ngày 15/10:
// Trang 3 lọc ngày 15/10 ra A tới P, trang Ngân hàng lọc ngân hàng 1 ra B tới Q, hai test không đổi dòng của nhau.
export const B_WAIT_COUNT = 17;
export const bWaitName = (i: number) => `Biên Chờ Kiểm ${String.fromCharCode(65 + i)}`;
export const bWaitId = (i: number) => id(400 + i);

export const B_LONG_NAME = exactly("Biên Nguyễn Hoàng Bảo Ngọc Phương Thảo Minh Châu Khánh Linh Thùy Dương ", 100);
export const B_LONG_CLASS = "12CHUYENTOANTINHOCAB";
export const B_UNBROKEN_NAME = exactly("BiênTênLiềnKhôngDấuCách", 100);
export const B_UNBROKEN_NOTE = exactly("GhiChúLiềnKhôngCóDấuCách", 1000);
// Worker SMS lưu tới 500 ký tự lỗi của nhà mạng.
export const B_LONG_SMS_ERROR = exactly("LỗiNhàMạngTrảVềKhôngCóDấuCách", 500);
export const B_XSS = "Biên <script>alert(1)</script>";
export const B_QUOTES = `Biên "Kép" 'Đơn' 50% a_b \\ x`;
export const B_EMOJI = "Biên 😀 Emoji Ðức";
export const B_FORMULA = "=1+2 Biên Công Thức";
export const B_FORMULA_CLASS = "=1+1";
export const B_MINUS = "-Biên Trừ";
export const B_LATE = "Biên Giờ Khuya";
export const B_EARLY = "Biên Giờ Sớm";
export const B_LATE_VOUCHER = "ZZBIEN-BGK-10A1-AAAA";
export const B_EARLY_VOUCHER = "ZZBIEN-BGS-10A1-BBBB";
export const B_FORMULA_VOUCHER = "ZZBIEN-BCT-11A1-FFFF";
export const B_MINUS_VOUCHER = "ZZBIEN-BTR-10A1-GGGG";

export const B_IDS = {
  long: id(201),
  unbroken: id(202),
  xss: id(203),
  quotes: id(204),
  emoji: id(205),
  formula: id(206),
  minus: id(207),
  only2: id(208),
  both: id(209),
  none: id(210),
  dup1: id(211),
  dup2: id(212),
  twoTabs: id(213),
  editTabs: id(214),
  replace: id(215),
  note: id(216),
  form: id(217),
  resend: id(218),
  resendTabs: id(219),
  late: id(220),
  early: id(221),
  oldPhoto: id(222),
  sameTime: id(223),
  failFirst: id(224),
  doubleClick: id(225),
  longError: id(226),
  lostBank: id(227),
  selfReplace: id(228),
  slotGone: id(229),
  replaceTabs: id(230),
  failThenPass: id(231),
} as const;

export const B_NAMES: Record<keyof typeof B_IDS, string> = {
  long: B_LONG_NAME,
  unbroken: B_UNBROKEN_NAME,
  xss: B_XSS,
  quotes: B_QUOTES,
  emoji: B_EMOJI,
  formula: B_FORMULA,
  minus: B_MINUS,
  only2: "Biên Chỉ Hai",
  both: "Biên Hai Ngân Hàng",
  none: "Biên Chưa Chọn",
  dup1: "Biên Trùng Tên",
  dup2: "Biên Trùng Tên",
  twoTabs: "Biên Hai Tab",
  editTabs: "Biên Sửa Hai Tab",
  replace: "Biên Thay Ảnh",
  note: "Biên Ghi Chú",
  form: "Biên Sửa Form",
  resend: "Biên Gửi Lại",
  resendTabs: "Biên Gửi Hai Tab",
  late: B_LATE,
  early: B_EARLY,
  oldPhoto: "Biên Ảnh Cũ",
  sameTime: "Biên Đạt Cùng Lúc",
  failFirst: "Biên Không Đạt Trước",
  doubleClick: "Biên Bấm Đúp",
  longError: "Biên Lỗi Dài",
  lostBank: "Biên Bỏ Giao",
  selfReplace: "Biên Tải Rồi Đạt",
  slotGone: "Biên Gỡ Khung",
  replaceTabs: "Biên Cùng Khung",
  failThenPass: "Biên Không Đạt Rồi Đạt",
};
