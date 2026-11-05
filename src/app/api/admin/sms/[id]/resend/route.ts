import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { isUuid, jsonBody, notFound } from "@/server/http/responses";
import { failResponse, zodFail } from "@/server/http/zod";
import { resendSms } from "@/server/sms/queue";
import { ResendForm } from "@/lib/smsForm";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "customers");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const parsed = ResendForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await resendSms(auth.user, id, parsed.data.toPhone, ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
