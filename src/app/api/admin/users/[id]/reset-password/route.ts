import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { isUuid, notFound } from "@/server/http/responses";
import { failResponse } from "@/server/http/zod";
import { resetPassword } from "@/server/users";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "users");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const r = await resetPassword(auth.user, id, ipFrom(request));
  return r.ok ? Response.json({ password: r.password }) : failResponse(r);
}
