import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { jsonBody } from "@/server/http/responses";
import { zodFail } from "@/server/http/zod";
import { updateOwnInfo } from "@/server/profile";
import { InfoForm } from "@/lib/profileForm";

export async function PATCH(request: Request) {
  const auth = await requireApi(request);
  if (!auth.ok) return auth.response;
  const parsed = InfoForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  await updateOwnInfo(auth.user, parsed.data, ipFrom(request));
  return new Response(null, { status: 204 });
}
