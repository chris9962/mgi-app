import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { exportCustomerBanks } from "@/server/exports";
import { excelResponse } from "@/server/http/excel";
import { parseCustomerBankFilters } from "@/lib/customerBankFilters";

export async function GET(request: Request) {
  const auth = await requireApi(request, "export_excel");
  if (!auth.ok) return auth.response;
  return excelResponse(await exportCustomerBanks(auth.user, parseCustomerBankFilters(new URL(request.url).searchParams), ipFrom(request)));
}
