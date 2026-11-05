import { requireApi } from "@/server/auth/current";
import { notFound } from "@/server/http/responses";
import { presignGet } from "@/server/storage";
import { isAdminImageKey } from "@/lib/imageKey";

// Ảnh mẫu và ảnh QR chỉ người đăng nhập trang quản lý xem. Link S3 hết hạn sau 10 phút.
export async function GET(request: Request) {
  const auth = await requireApi(request);
  if (!auth.ok) return auth.response;
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!isAdminImageKey(key)) return notFound();
  return Response.redirect(await presignGet(key), 302);
}
