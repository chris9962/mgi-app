import { isIP } from "node:net";

// Nginx nối địa chỉ thật của kết nối vào cuối X-Forwarded-For (deploy/nginx/proxy.conf), phần đứng trước do người gửi tự khai được.
// App chỉ nghe 127.0.0.1 sau Nginx nên địa chỉ cuối là địa chỉ Nginx ghi.
export function ipFrom(request: Request): string | null {
  const last = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "";
  return isIP(last) ? last : null;
}
