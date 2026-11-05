import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Huy hiệu dev mặc định nằm góc trái dưới, đè lên menu tài khoản của sidebar.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
