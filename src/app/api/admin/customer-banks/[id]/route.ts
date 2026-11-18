import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { deleteCustomerBank } from "@/server/customerDelete";
import { isUuid, notFound } from "@/server/http/responses";
import { failResponse } from "@/server/http/zod";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "delete_customers");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const r = await deleteCustomerBank(auth.user, id, ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
