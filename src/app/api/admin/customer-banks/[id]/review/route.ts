import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { isUuid, jsonBody, notFound } from "@/server/http/responses";
import { failResponse, zodFail } from "@/server/http/zod";
import { reviewCustomerBank } from "@/server/review";
import { ReviewForm } from "@/lib/reviewForm";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "customers");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const parsed = ReviewForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await reviewCustomerBank(auth.user, { customerBankId: id, ...parsed.data }, ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
