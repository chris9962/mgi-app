import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { markGiftPaid } from "@/server/gift";
import { isUuid, notFound } from "@/server/http/responses";
import { failResponse } from "@/server/http/zod";

// Đánh dấu đã chuyển quà 20.000 đồng cho học sinh.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "customers");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const r = await markGiftPaid(auth.user, id, ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
