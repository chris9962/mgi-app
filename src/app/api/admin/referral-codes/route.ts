import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { jsonBody } from "@/server/http/responses";
import { failResponse, zodFail } from "@/server/http/zod";
import { createCode } from "@/server/referralCodes";
import { CodeForm } from "@/lib/codeForm";

export async function POST(request: Request) {
  const auth = await requireApi(request);
  if (!auth.ok) return auth.response;
  const parsed = CodeForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await createCode(auth.user, parsed.data, ipFrom(request));
  return r.ok ? Response.json({ id: r.id }, { status: 201 }) : failResponse(r);
}
