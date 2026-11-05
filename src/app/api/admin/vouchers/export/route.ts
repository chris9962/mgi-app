import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { exportVouchers } from "@/server/exports";
import { excelResponse } from "@/server/http/excel";
import { parseVoucherFilters } from "@/lib/voucherFilters";

export async function GET(request: Request) {
  const auth = await requireApi(request, "export_excel");
  if (!auth.ok) return auth.response;
  return excelResponse(await exportVouchers(auth.user, parseVoucherFilters(new URL(request.url).searchParams), ipFrom(request)));
}
