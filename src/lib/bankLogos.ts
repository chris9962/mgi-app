// Logo lấy từ bộ logo VietQR (cdn.vietqr.io/img), đã cắt viền và đặt lên nền trắng để đọc được ở cả bộ màu tối.
export const BANK_LOGOS: Record<string, string> = {
  MB: "/banks/mb.webp",
  TPB: "/banks/tpb.webp",
  BIDV: "/banks/bidv.webp",
  LPB: "/banks/lpb.webp",
  MBV: "/banks/mbv.webp",
  MSBA: "/banks/msb.webp",
  MSBB: "/banks/msb.webp",
  SHB: "/banks/shb.webp",
  TCB: "/banks/tcb.webp",
  VIB: "/banks/vib.webp",
  VPA: "/banks/vpb.webp",
  VPB: "/banks/vpb.webp",
};

export const bankLogo = (code: string): string | null => BANK_LOGOS[code] ?? null;
