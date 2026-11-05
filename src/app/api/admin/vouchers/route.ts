import { requireApi } from "@/server/auth/current";
import { listVouchers } from "@/server/vouchers";
import { parseVoucherFilters } from "@/lib/voucherFilters";

export async function GET(request: Request) {
  const auth = await requireApi(request, "vouchers");
  if (!auth.ok) return auth.response;
  const sp = new URL(request.url).searchParams;
  return Response.json(await listVouchers(auth.user, parseVoucherFilters(sp), Number(sp.get("page")) || 1));
}
