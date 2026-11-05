import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { exportCustomers } from "@/server/exports";
import { excelResponse } from "@/server/http/excel";
import { parseCustomerFilters } from "@/lib/customerFilters";

export async function GET(request: Request) {
  const auth = await requireApi(request, "export_excel");
  if (!auth.ok) return auth.response;
  return excelResponse(await exportCustomers(auth.user, parseCustomerFilters(new URL(request.url).searchParams), ipFrom(request)));
}
