import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { isUuid, jsonBody, notFound } from "@/server/http/responses";
import { failResponse, zodFail } from "@/server/http/zod";
import { getGuide, saveGuide } from "@/server/banks";
import { GuideForm } from "@/lib/bankForm";
import { canManageBank } from "@/lib/permissions";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id) || !canManageBank(auth.user, id)) return notFound();
  return Response.json(await getGuide(id));
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const parsed = GuideForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await saveGuide(auth.user, id, parsed.data, ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
