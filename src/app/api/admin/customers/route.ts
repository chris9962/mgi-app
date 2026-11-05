import { requireApi } from "@/server/auth/current";
import { listCustomers } from "@/server/customerList";
import { parseCustomerFilters } from "@/lib/customerFilters";

export async function GET(request: Request) {
  const auth = await requireApi(request, "customers");
  if (!auth.ok) return auth.response;
  const sp = new URL(request.url).searchParams;
  return Response.json(await listCustomers(auth.user, parseCustomerFilters(sp), Number(sp.get("page")) || 1));
}
