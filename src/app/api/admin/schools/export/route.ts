import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { exportSchools } from "@/server/exports";
import { excelResponse } from "@/server/http/excel";

export async function GET(request: Request) {
  const auth = await requireApi(request, "export_excel");
  if (!auth.ok) return auth.response;
  return excelResponse(await exportSchools(auth.user, new URL(request.url).searchParams.get("q") ?? "", ipFrom(request)));
}
