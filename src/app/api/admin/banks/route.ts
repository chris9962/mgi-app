import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { jsonBody } from "@/server/http/responses";
import { failResponse, zodFail } from "@/server/http/zod";
import { createBank } from "@/server/banks";
import { BankForm } from "@/lib/bankForm";

export async function POST(request: Request) {
  const auth = await requireApi(request, "manage_banks");
  if (!auth.ok) return auth.response;
  const parsed = BankForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await createBank(auth.user, parsed.data, ipFrom(request));
  return r.ok ? Response.json({ id: r.id }, { status: 201 }) : failResponse(r);
}
