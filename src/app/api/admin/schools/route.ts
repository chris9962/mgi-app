import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { jsonBody } from "@/server/http/responses";
import { failResponse, zodFail } from "@/server/http/zod";
import { createSchool } from "@/server/schools";
import { SchoolForm } from "@/lib/schoolForm";

export async function POST(request: Request) {
  const auth = await requireApi(request, "schools");
  if (!auth.ok) return auth.response;
  const parsed = SchoolForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await createSchool(auth.user, parsed.data, ipFrom(request));
  return r.ok ? Response.json({ id: r.id }, { status: 201 }) : failResponse(r);
}
