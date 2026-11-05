import { photoUploadUrl } from "@/server/customerPhotos";
import { jsonBody } from "@/server/http/responses";
import { requireStudent } from "@/server/http/student";
import { failResponse, zodFail } from "@/server/http/zod";
import { PhotoUploadForm } from "@/lib/customerForm";

// Ảnh đi thẳng từ điện thoại lên S3: máy chủ chỉ cấp link PUT cho đúng một khung ảnh của học sinh.
export async function POST(request: Request) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;
  const parsed = PhotoUploadForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await photoUploadUrl(auth.customer, parsed.data);
  return r.ok ? Response.json({ url: r.url, key: r.key }) : failResponse(r);
}
