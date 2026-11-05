import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { jsonBody } from "@/server/http/responses";
import { failResponse, zodFail } from "@/server/http/zod";
import { saveSettings } from "@/server/settings";
import { SettingsForm } from "@/lib/sms";

export async function PATCH(request: Request) {
  const auth = await requireApi(request, "system");
  if (!auth.ok) return auth.response;
  const parsed = SettingsForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await saveSettings(auth.user, parsed.data, ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
