import { uploadPhoto } from "@/server/customerPhotos";
import { requireStudent } from "@/server/http/student";
import { failResponse, zodFail } from "@/server/http/zod";
import { PhotoTargetForm } from "@/lib/customerForm";
import { bodyTooLarge } from "@/lib/imageKey";

// Ảnh đi qua máy chủ như mgst-app: khoá S3 không rời máy chủ, mọi file đều qua bước kiểm chữ ký và đổi WebP.
export async function POST(request: Request) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;
  if (bodyTooLarge(request)) return Response.json({ message: "Ảnh lớn hơn 20 MB.", field: "file" }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const parsed = PhotoTargetForm.safeParse({ customerBankId: form?.get("customerBankId"), slotId: form?.get("slotId") });
  if (!parsed.success) return zodFail(parsed.error);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return Response.json({ message: "Chọn ảnh.", field: "file" }, { status: 400 });
  const r = await uploadPhoto(auth.customer, parsed.data, new Uint8Array(await file.arrayBuffer()));
  return r.ok ? new Response(null, { status: 201 }) : failResponse(r);
}
