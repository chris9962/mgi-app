import { claimGift } from "@/server/gift";
import { jsonBody } from "@/server/http/responses";
import { requireStudent } from "@/server/http/student";
import { failResponse, zodFail } from "@/server/http/zod";
import { GiftForm } from "@/lib/giftForm";

// Học sinh khai tài khoản nhận quà 20.000 đồng sau khi gửi kiểm tra từ 2 ngân hàng.
export async function POST(request: Request) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;
  const parsed = GiftForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await claimGift(auth.customer, parsed.data);
  return r.ok ? new Response(null, { status: 204 }) : failResponse(r);
}
