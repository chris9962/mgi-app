import { requireApi } from "@/server/auth/current";
import { searchSchoolOptions } from "@/server/schools";

// Ô tìm trường của bộ lọc trang Ngân hàng: tối đa 20 dòng, có cả trường đã đóng.
export async function GET(request: Request) {
  const auth = await requireApi(request, "customers");
  if (!auth.ok) return auth.response;
  return Response.json(await searchSchoolOptions(new URL(request.url).searchParams.get("q") ?? "", { closed: true }));
}
