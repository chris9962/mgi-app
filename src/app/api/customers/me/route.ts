import { customerFromRequest, studentState, touchCustomer, updateOwnCustomer } from "@/server/customers";
import { jsonBody } from "@/server/http/responses";
import { requireStudent, studentUnauthorized } from "@/server/http/student";
import { failResponse, zodFail } from "@/server/http/zod";
import { CustomerSelfEditForm } from "@/lib/customerForm";

export async function GET(request: Request) {
  const customer = await customerFromRequest(request);
  if (!customer) return studentUnauthorized();
  await touchCustomer(customer.id);
  return Response.json(await studentState(customer));
}

export async function PATCH(request: Request) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;
  const parsed = CustomerSelfEditForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await updateOwnCustomer(auth.customer, parsed.data);
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
