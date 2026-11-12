import { requireApi } from "@/server/auth/current";
import { searchSchoolOptions } from "@/server/schools";
import { readParam } from "@/lib/urlParams";

// Ô tìm trường của bộ lọc trang Mã voucher: người chỉ có quyền voucher không gọi được route của trang Ngân hàng.
export async function GET(request: Request) {
  const auth = await requireApi(request, "vouchers");
  if (!auth.ok) return auth.response;
  return Response.json(await searchSchoolOptions(readParam(new URL(request.url).searchParams, "q"), { closed: true }));
}
