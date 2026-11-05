import { destroySession, expiredCookie, tokenFromRequest } from "@/server/auth/session";
import { forbidden } from "@/server/http/responses";
import { configuredHosts, sameOrigin } from "@/lib/hosts";

export async function POST(request: Request) {
  if (!sameOrigin(request, configuredHosts().admin)) return forbidden();
  await destroySession(tokenFromRequest(request));
  return new Response(null, { status: 204, headers: { "Set-Cookie": expiredCookie() } });
}
