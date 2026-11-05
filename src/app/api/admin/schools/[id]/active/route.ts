import { z } from "zod";
import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { badRequest, isUuid, jsonBody, notFound } from "@/server/http/responses";
import { failResponse } from "@/server/http/zod";
import { setSchoolActive } from "@/server/schools";

const Body = z.object({ active: z.boolean() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "schools");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const parsed = Body.safeParse(await jsonBody(request));
  if (!parsed.success) return badRequest();
  const r = await setSchoolActive(auth.user, id, parsed.data.active, ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
