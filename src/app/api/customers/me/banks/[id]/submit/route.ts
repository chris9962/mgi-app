import { submitBank } from "@/server/customers";
import { isUuid, notFound } from "@/server/http/responses";
import { requireStudent } from "@/server/http/student";
import { failResponse } from "@/server/http/zod";

// Gửi kiểm tra riêng một ngân hàng đã đủ ảnh; các ngân hàng khác vẫn nộp ảnh tiếp. Trả số ngân hàng đã gửi để web báo quà.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const r = await submitBank(auth.customer, id);
  return r.ok ? Response.json({ submitted: r.submitted }) : failResponse(r);
}
