import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image Docker chạy bun server.js của bản standalone, không mang trọn node_modules.
  output: "standalone",
  // Huy hiệu dev đè lên menu tài khoản của sidebar (góc trái) và nút Thêm của thanh đáy điện thoại (góc phải). Lỗi biên dịch vẫn hiện.
  devIndicators: false,
  // Proxy chép body vào bộ nhớ và mặc định chỉ giữ 10 MB: ảnh lớn hơn bị cắt, route nhận multipart hỏng. Bằng trần body của Nginx.
  experimental: { proxyClientMaxBodySize: "22mb" },
};

export default nextConfig;
