import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { exportSchools } from "@/server/exports";
import { excelResponse } from "@/server/http/excel";
import { readParam } from "@/lib/urlParams";

export async function GET(request: Request) {
  const auth = await requireApi(request, "export_excel");
  if (!auth.ok) return auth.response;
  return excelResponse(await exportSchools(auth.user, readParam(new URL(request.url).searchParams, "q"), ipFrom(request)));
}
