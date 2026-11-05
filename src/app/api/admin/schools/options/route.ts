import { requireApi } from "@/server/auth/current";
import { forbidden } from "@/server/http/responses";
import { searchSchoolOptions } from "@/server/schools";
import { canManageAnyBank } from "@/lib/permissions";

// Ô chọn trường của hộp thoại mã giới thiệu: tìm theo từ khoá, tối đa 20 dòng, không phân trang.
export async function GET(request: Request) {
  const auth = await requireApi(request);
  if (!auth.ok) return auth.response;
  if (!canManageAnyBank(auth.user)) return forbidden();
  return Response.json(await searchSchoolOptions(new URL(request.url).searchParams.get("q") ?? ""));
}
