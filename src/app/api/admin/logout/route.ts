import { destroySession, expiredCookie, tokenFromRequest } from "@/server/auth/session";

export async function POST(request: Request) {
  await destroySession(tokenFromRequest(request));
  return new Response(null, { status: 204, headers: { "Set-Cookie": expiredCookie() } });
}
