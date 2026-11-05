import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { isUuid, jsonBody, notFound } from "@/server/http/responses";
import { failResponse, zodFail } from "@/server/http/zod";
import { updateSchool } from "@/server/schools";
import { SchoolForm } from "@/lib/schoolForm";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "schools");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const parsed = SchoolForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await updateSchool(auth.user, id, parsed.data, ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
