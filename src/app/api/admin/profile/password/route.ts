import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { hashToken, tokenFromRequest } from "@/server/auth/session";
import { jsonBody } from "@/server/http/responses";
import { failResponse, zodFail } from "@/server/http/zod";
import { changeOwnPassword } from "@/server/profile";
import { PasswordForm } from "@/lib/profileForm";

export async function POST(request: Request) {
  const auth = await requireApi(request);
  if (!auth.ok) return auth.response;
  const parsed = PasswordForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const token = tokenFromRequest(request);
  const r = await changeOwnPassword(auth.user, token ? hashToken(token) : null, parsed.data, ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
