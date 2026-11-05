import { reserveBanks } from "@/server/customers";
import { jsonBody } from "@/server/http/responses";
import { requireStudent } from "@/server/http/student";
import { failResponse, zodFail } from "@/server/http/zod";
import { BankChoiceForm } from "@/lib/customerForm";

export async function POST(request: Request) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;
  const parsed = BankChoiceForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await reserveBanks(auth.customer, parsed.data.bankIds);
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
