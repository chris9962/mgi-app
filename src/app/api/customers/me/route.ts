import { customerFromRequest, studentState, touchCustomer } from "@/server/customers";
import { studentUnauthorized } from "@/server/http/student";

export async function GET(request: Request) {
  const customer = await customerFromRequest(request);
  if (!customer) return studentUnauthorized();
  await touchCustomer(customer.id);
  return Response.json(await studentState(customer));
}
