import { requireApi } from "@/server/auth/current";
import { listWards } from "@/server/schools";

export async function GET(request: Request) {
  const auth = await requireApi(request, "schools");
  if (!auth.ok) return auth.response;
  const province = new URL(request.url).searchParams.get("province") ?? "";
  return Response.json(/^[0-9]{2}$/.test(province) ? await listWards(province) : []);
}
