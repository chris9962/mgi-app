import { customerFromRequest, ownCustomerInfo } from "@/server/customers";
import { studentUnauthorized } from "@/server/http/student";
import { failResponse } from "@/server/http/zod";

export async function GET(request: Request) {
  const customer = await customerFromRequest(request);
  if (!customer) return studentUnauthorized();
  const r = await ownCustomerInfo(customer);
  return r.ok ? Response.json(r.info) : failResponse(r);
}
