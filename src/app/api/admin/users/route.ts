import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { jsonBody } from "@/server/http/responses";
import { failResponse, zodFail } from "@/server/http/zod";
import { createUser } from "@/server/users";
import { UserForm } from "@/lib/userForm";

export async function POST(request: Request) {
  const auth = await requireApi(request, "users");
  if (!auth.ok) return auth.response;
  const parsed = UserForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await createUser(auth.user, parsed.data, ipFrom(request));
  return r.ok ? Response.json({ id: r.id, password: r.password }, { status: 201 }) : failResponse(r);
}
