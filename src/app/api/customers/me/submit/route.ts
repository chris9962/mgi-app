import { submitForReview } from "@/server/customers";
import { requireStudent } from "@/server/http/student";
import { failResponse } from "@/server/http/zod";

// Gửi một lần cho mọi ngân hàng đã chọn; sau bước này hồ sơ khoá, API ảnh từ chối học sinh.
export async function POST(request: Request) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;
  const r = await submitForReview(auth.customer);
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
