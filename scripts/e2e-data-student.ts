// Hằng của dữ liệu ca biên web học sinh; file này không nối DB để Playwright import được.
export const HSB = "ZZE2E HSB ";

const id = (n: string) => `e2e0a000-0000-4000-8000-00000000${n}`;

export const SCHOOL = {
  long: id("a001"),
  closed: id("a002"),
  empty: id("a003"),
  quota: id("a004"),
  photo: id("a005"),
  noGuide: id("a006"),
  closing: id("a007"),
  stale: id("a008"),
  mixed: id("a009"),
} as const;

export const BANK = {
  longSpace: id("b001"),
  longWord: id("b002"),
  q1: id("b003"),
  q2: id("b004"),
  p1: id("b005"),
  p2: id("b006"),
  p3: id("b007"),
  p4: id("b008"),
  stale: id("b009"),
} as const;

export const SLOT = {
  longSpace1: id("c001"),
  longSpace2: id("c002"),
  longWord: id("c003"),
  q1: id("c004"),
  q2: id("c005"),
  p1Main: id("c006"),
  p1Transfer: id("c007"),
  p3: id("c008"),
  p4: id("c009"),
  stale1: id("c00a"),
  stale2: id("c00b"),
  staleAdded: id("c00c"),
} as const;

export const CODE = {
  longSpace: id("d001"),
  longWord: id("d002"),
  q1: id("d003"),
  q2: id("d004"),
  p1: id("d005"),
  p2: id("d006"),
  p3: id("d007"),
  p4: id("d008"),
  stale: id("d009"),
} as const;

const NO_SPACE = "THPTCHUYENLEQUYDONTHANHPHOHOCHIMINHCOSOHAIKHONGCODAUCACHNAOCA";

export const NAME = {
  schoolLong: `${HSB}Trường THPT <script>alert(1)</script> & "Lê" 'Quý' Đôn 😀 ${NO_SPACE}`,
  schoolClosed: `${HSB}Trường đã đóng`,
  schoolEmpty: `${HSB}Trường chưa có ngân hàng`,
  schoolQuota: `${HSB}Trường hết lượt`,
  schoolPhoto: `${HSB}Trường thử ảnh`,
  schoolNoGuide: `${HSB}Trường có ngân hàng chưa cài hướng dẫn`,
  schoolClosing: `${HSB}Trường đóng giữa chừng`,
  schoolStale: `${HSB}Trường đổi khung ảnh`,
  schoolMixed: `${HSB}Trường có tên ngân hàng dài và ngắn`,
  bankLongSpace: `${HSB}Ngân hàng Thương mại Cổ phần Việt Nam Thịnh Vượng chi nhánh Thành phố Hồ Chí Minh`,
  bankLongWord: `${HSB}NGANHANGTHUONGMAICOPHANKYTHUONGVIETNAMTECHCOMBANKHOISOCHINH`,
  q1: `${HSB}Q1`,
  q2: `${HSB}Q2`,
  p1: `${HSB}P1`,
  p2: `${HSB}P2 chưa cài hướng dẫn`,
  p3: `${HSB}P3`,
  p4: `${HSB}P4`,
  stale: `${HSB}Đổi khung`,
  slotLongSpace: "Ảnh màn hình chính sau khi mở tài khoản thành công có đủ họ tên và số tài khoản",
  slotLongWord: "ẢNHCHUYỂNKHOẢNTHÀNHCÔNGCÓSỐTÀIKHOẢNVÀMÃGIỚITHIỆUĐẦYĐỦKHÔNGCẮTGÓC",
} as const;

export const GUIDE_LONG = [
  "Tải app ngân hàng trên CH Play hoặc App Store, mở app, chọn Mở tài khoản trực tuyến, chụp hai mặt căn cước và quay video khuôn mặt theo hướng dẫn trên màn hình.",
  "Mở https://example.com/mo-tai-khoan-online-cho-hoc-sinh-sinh-vien-duoi-18-tuoi-khong-can-ra-quay-giao-dich?ref=HSBLONG",
  'Nhập <b>mã giới thiệu</b> & bấm "Tiếp"',
];

export const LONG_CODE = "HSBLONGREFERRALCODE0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const LONG_OPEN_URL = "https://example.com/mo tai khoan?ref=HSB LONG";
