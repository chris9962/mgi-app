import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { PHOTO_LINK_SECONDS, photoForView } from "@/server/customerDetail";
import { isUuid, notFound } from "@/server/http/responses";
import { presignGet } from "@/server/storage";

// Ảnh học sinh chỉ người quản ngân hàng của dòng ảnh, Quản trị, Quản lý xem được. Lần xem ghi audit, link S3 sống 10 phút.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "customers");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const r = await photoForView(auth.user, id, ipFrom(request));
  if (!r.ok) return notFound();
  return new Response(null, { status: 302, headers: { Location: await presignGet(r.key, PHOTO_LINK_SECONDS), "Cache-Control": "no-store" } });
}
