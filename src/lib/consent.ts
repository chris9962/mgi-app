import { BRAND_NAME, BRAND_SHORT } from "./brand";

// Đổi câu chữ ở CONSENT_SECTIONS thì đổi số này: hồ sơ lưu số phiên bản để biết học sinh đã đồng ý nội dung nào.
export const CONSENT_VERSION = "2026-11-13";

export const CONSENT_TITLE = "Điều khoản xử lý dữ liệu cá nhân";

export const CONSENT_SECTIONS: { title: string; lines: string[] }[] = [
  { title: "Đơn vị thu thập dữ liệu", lines: [`${BRAND_NAME} (${BRAND_SHORT}).`] },
  {
    title: "Dữ liệu thu thập",
    lines: [
      "Họ tên, lớp, trường, SĐT của học sinh.",
      "Họ tên, SĐT của phụ huynh.",
      "Ngân hàng học sinh đã có tài khoản.",
      "Ảnh chụp màn hình app ngân hàng. Ảnh có thể chứa thông tin tài khoản ngân hàng, là dữ liệu cá nhân nhạy cảm.",
    ],
  },
  {
    title: "Mục đích",
    lines: ["Xác nhận học sinh đã mở tài khoản ngân hàng.", "Gửi mã voucher bảo hiểm qua SMS tới SĐT phụ huynh.", `${BRAND_SHORT} không dùng dữ liệu cho mục đích khác.`],
  },
  { title: "Bên nhận dữ liệu", lines: ["Đơn vị gửi tin SMS nhận SĐT phụ huynh và nội dung tin.", `${BRAND_SHORT} không bán dữ liệu.`] },
  { title: "Thời gian lưu", lines: [`${BRAND_SHORT} lưu dữ liệu tới khi học sinh hoặc phụ huynh yêu cầu xoá.`] },
  {
    title: "Quyền của học sinh và phụ huynh",
    lines: [
      "Xem, sửa, yêu cầu xoá dữ liệu.",
      "Yêu cầu hạn chế xử lý, rút lại đồng ý, khiếu nại.",
      `${BRAND_SHORT} trả lời yêu cầu trong 2 ngày làm việc.`,
      "Rút lại đồng ý không áp dụng cho phần xử lý đã xong trước đó.",
    ],
  },
  {
    title: "Cam kết của người khai",
    lines: ["Người khai đủ 18 tuổi.", "Thông tin khai đầy đủ, chính xác.", "Phụ huynh đã đồng ý cho khai họ tên và SĐT của phụ huynh."],
  },
  { title: "Liên hệ", lines: [`Gửi yêu cầu qua Zalo của ${BRAND_SHORT} trên trang này.`] },
];
