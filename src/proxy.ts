import { NextResponse, type NextRequest } from "next/server";
import { configuredHosts, routeFor } from "@/lib/hosts";

export function proxy(request: NextRequest) {
  const route = routeFor(request.headers.get("host"), request.nextUrl.pathname, configuredHosts());
  if (route.kind === "next") return NextResponse.next();
  if (route.kind === "notFound") return new NextResponse(null, { status: 404 });
  const url = request.nextUrl.clone();
  url.pathname = route.path;
  return NextResponse.rewrite(url);
}

// Chỉ file có thật trong public (logo, wasm của bộ đọc QR) đi thẳng; rewrite sang /admin thì trình duyệt nhận 404.
// Liệt kê đích danh: bỏ qua theo đuôi ảnh thì /admin/...x.png đi vòng qua bước kiểm tên miền. Thêm file vào public thì thêm vào đây.
export const config = {
  matcher: ["/((?!_next/|brand/|banks/|zxing_reader\\.wasm$).*)"],
};
