import { requireApi } from "@/server/auth/current";
import { ipFrom } from "@/server/audit";
import { isUuid, notFound } from "@/server/http/responses";
import { failResponse } from "@/server/http/zod";
import { replacePhoto } from "@/server/review";
import { MAX_IMAGE_BYTES } from "@/server/storage";
import { bodyTooLarge } from "@/lib/imageKey";

// Tải ảnh thay thế cho một khung của dòng ngân hàng; ảnh đi qua máy chủ để kiểm chữ ký file.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "customers");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  if (bodyTooLarge(request)) return Response.json({ message: "Ảnh lớn hơn 20 MB.", field: "file" }, { status: 400 });
  const form = await request.formData().catch(() => null);
  const slotId = String(form?.get("slotId") ?? "");
  const file = form?.get("file");
  if (!isUuid(slotId)) return Response.json({ message: "Chọn khung ảnh.", field: "slotId" }, { status: 400 });
  if (!(file instanceof File) || !file.size) return Response.json({ message: "Chọn ảnh.", field: "file" }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return Response.json({ message: "Ảnh lớn hơn 20 MB.", field: "file" }, { status: 400 });
  const r = await replacePhoto(auth.user, { customerBankId: id, slotId }, new Uint8Array(await file.arrayBuffer()), ipFrom(request));
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
