// Dữ liệu của video hướng dẫn: tên giống người dùng thật vì video chiếu cho người dùng, không có tiền tố ZZE2E.
export const VIDEO_DB = "mgibank_video";
export const VIDEO_PASSWORD = "Minhgroup@2026";

export const VIDEO_USERS = {
  admin: { username: "minh.nguyen", staffCode: "QT001", fullName: "Nguyễn Văn Minh", role: "admin", title: "Quản trị hệ thống" },
  manager: { username: "bao.tran", staffCode: "QL001", fullName: "Trần Quốc Bảo", role: "manager", title: "Trưởng phòng" },
  lan: { username: "lan.nguyen", staffCode: "NV001", fullName: "Nguyễn Thị Lan", role: "staff", title: "Hậu kiểm" },
  tuan: { username: "tuan.le", staffCode: "NV002", fullName: "Lê Minh Tuấn", role: "staff", title: "Hậu kiểm" },
  ha: { username: "ha.pham", staffCode: "NV003", fullName: "Phạm Thu Hà", role: "staff", title: "Hậu kiểm" },
  nam: { username: "nam.vo", staffCode: "NV004", fullName: "Võ Thành Nam", role: "staff", title: "Hậu kiểm" },
  mai: { username: "mai.dang", staffCode: "NV005", fullName: "Đặng Ngọc Mai", role: "staff", title: "Hậu kiểm" },
} as const;

export type VideoUserKey = keyof typeof VIDEO_USERS;

// Mã ngân hàng của scripts/data/banks.json mà từng nhân viên quản.
export const VIDEO_MANAGED_BANKS: Partial<Record<VideoUserKey, string[]>> = {
  lan: ["MB", "TPB"],
  tuan: ["VPB", "VPA"],
  ha: ["LPB", "SHB"],
  nam: ["MBV", "MSBB"],
};

export const VIDEO_SCHOOL = { id: "6f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f", name: "THPT Lê Quý Đôn", wardCode: "25585", contactName: "Lê Thu Hương", contactPhone: "0903111222" };

// Ba ngân hàng của video học sinh: mã giới thiệu gắn trường, ảnh QR vẽ từ link mở tài khoản.
export const VIDEO_CODES = [
  { bank: "MB", displayName: "MB Bank Lê Quý Đôn", code: "LQD-MB-01", openUrl: "https://www.mbbank.com.vn" },
  { bank: "TPB", displayName: "TPBank Lê Quý Đôn", code: "LQD-TPB-01", openUrl: "https://tpb.vn" },
  { bank: "VPB", displayName: "VPBank NEO Lê Quý Đôn", code: "LQD-VPB-01", openUrl: "https://www.vpbank.com.vn" },
];
