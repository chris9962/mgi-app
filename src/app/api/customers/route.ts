import { ipFrom } from "@/server/audit";
import { createCustomer } from "@/server/customers";
import { forbidden, jsonBody } from "@/server/http/responses";
import { fromStudentSite } from "@/server/http/student";
import { failResponse, zodFail } from "@/server/http/zod";
import { CustomerForm } from "@/lib/customerForm";

// B1 không cần token; giới hạn số lần tạo theo IP làm ở Nginx.
export async function POST(request: Request) {
  if (!fromStudentSite(request)) return forbidden();
  const parsed = CustomerForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await createCustomer(parsed.data, ipFrom(request));
  return r.ok ? Response.json({ id: r.id, token: r.token }, { status: 201 }) : failResponse(r);
}
