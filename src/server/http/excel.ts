import { failResponse } from "./zod";
import { XLSX_TYPE } from "@/lib/excel";
import type { ExportResult } from "../exports";

export const excelResponse = (r: ExportResult) =>
  r.ok ? new Response(new Uint8Array(r.bytes), { headers: { "Content-Type": XLSX_TYPE, "Content-Disposition": `attachment; filename="${r.fileName}"`, "Cache-Control": "no-store" } }) : failResponse(r);
