import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { readCustomerBankFilters } from "@/server/customerBankList";
import { exportCustomerBanks } from "@/server/exports";
import { excelResponse } from "@/server/http/excel";

export async function GET(request: Request) {
  const auth = await requireApi(request, "export_excel");
  if (!auth.ok) return auth.response;
  const { filters } = await readCustomerBankFilters(auth.user, new URL(request.url).searchParams);
  return excelResponse(await exportCustomerBanks(auth.user, filters, ipFrom(request)));
}
