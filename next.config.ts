import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Image Docker chạy bun server.js của bản standalone, không mang trọn node_modules.
  output: "standalone",
  // Huy hiệu dev mặc định nằm góc trái dưới, đè lên menu tài khoản của sidebar.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
