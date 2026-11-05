import { z } from "zod";
import { attemptLogin } from "@/server/auth/login";
import { createSession } from "@/server/auth/session";
import { badRequest, forbidden, jsonBody } from "@/server/http/responses";
import { configuredHosts, sameOrigin } from "@/lib/hosts";

const Body = z.object({ username: z.string().min(1), password: z.string().min(1) });

export async function POST(request: Request) {
  if (!sameOrigin(request, configuredHosts().admin)) return forbidden();
  const parsed = Body.safeParse(await jsonBody(request));
  if (!parsed.success) return badRequest("Nhập tên đăng nhập và mật khẩu.");
  const result = await attemptLogin(parsed.data.username, parsed.data.password);
  if (!result.ok) return Response.json({ code: result.code, message: result.message }, { status: result.code === "locked" ? 423 : 401 });
  const { cookie } = await createSession(result.userId);
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookie } });
}
