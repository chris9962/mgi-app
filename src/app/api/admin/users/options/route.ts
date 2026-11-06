import { requireApi } from "@/server/auth/current";
import { managerOptions } from "@/server/banks";
import { readParam } from "@/lib/urlParams";

// Ô chọn người quản ngân hàng: tìm Nhân viên theo tên, tối đa 20 dòng.
export async function GET(request: Request) {
  const auth = await requireApi(request, "manage_banks");
  if (!auth.ok) return auth.response;
  return Response.json(await managerOptions(readParam(new URL(request.url).searchParams, "q")));
}
