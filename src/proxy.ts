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

// File tĩnh trong public (ảnh, font, wasm của bộ đọc QR) đi thẳng; rewrite sang /admin thì trình duyệt nhận 404.
export const config = {
  matcher: ["/((?!_next/|.*\\.(?:png|jpe?g|webp|svg|ico|woff2?|wasm|txt|webmanifest)$).*)"],
};
