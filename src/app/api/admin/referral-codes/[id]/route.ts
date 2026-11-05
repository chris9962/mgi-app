import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { isUuid, jsonBody, notFound } from "@/server/http/responses";
import { failResponse, zodFail } from "@/server/http/zod";
import { updateCode } from "@/server/referralCodes";
import { CodeForm } from "@/lib/codeForm";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const parsed = CodeForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await updateCode(auth.user, id, parsed.data, ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
