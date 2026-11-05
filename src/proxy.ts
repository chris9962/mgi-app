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

export const config = {
  matcher: ["/((?!_next/|favicon.ico|brand/|fonts/).*)"],
};
