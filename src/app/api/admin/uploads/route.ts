import { requireApi } from "@/server/auth/current";
import { badRequest, forbidden } from "@/server/http/responses";
import { FOLDERS, MAX_IMAGE_BYTES, putImage, type Folder } from "@/server/storage";
import { bodyTooLarge } from "@/lib/imageKey";
import { canManageAnyBank } from "@/lib/permissions";

// Ảnh mẫu của khung và ảnh QR của mã: người quản ngân hàng tải lên. Ảnh đi qua máy chủ để kiểm chữ ký file.
export async function POST(request: Request) {
  const auth = await requireApi(request);
  if (!auth.ok) return auth.response;
  if (!canManageAnyBank(auth.user)) return forbidden();
  const folder = new URL(request.url).searchParams.get("folder") as Folder;
  if (!FOLDERS.includes(folder)) return badRequest("Thư mục ảnh không hợp lệ.");
  if (bodyTooLarge(request)) return badRequest("Ảnh lớn hơn 10 MB.");
  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return badRequest("Chưa chọn ảnh.");
  if (file.size > MAX_IMAGE_BYTES) return badRequest("Ảnh lớn hơn 10 MB.");
  const r = await putImage(new Uint8Array(await file.arrayBuffer()), folder);
  return r.ok ? Response.json({ key: r.key }, { status: 201 }) : badRequest(r.message);
}
