import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { deleteCustomer } from "@/server/customerDelete";
import { getCustomerDetail, updateCustomerInfo } from "@/server/customerDetail";
import { isUuid, jsonBody, notFound } from "@/server/http/responses";
import { failResponse, zodFail } from "@/server/http/zod";
import { CustomerEditForm } from "@/lib/customerForm";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "customers");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const detail = isUuid(id) ? await getCustomerDetail(auth.user, id) : null;
  return detail ? Response.json(detail) : notFound();
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "customers");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const parsed = CustomerEditForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await updateCustomerInfo(auth.user, id, parsed.data, ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "delete_customers");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const r = await deleteCustomer(auth.user, id, ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
