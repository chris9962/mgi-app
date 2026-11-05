import { openBanksAtSchool } from "@/server/customers";
import { isUuid, notFound } from "@/server/http/responses";
import { publicSchool } from "@/server/schools";

// Web học sinh kiểm id trong link QR. Trường đã đóng vẫn trả về để web báo trường đã đóng.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const school = isUuid(id) ? await publicSchool(id) : null;
  if (!school) return notFound();
  return Response.json({ ...school, banks: school.active ? await openBanksAtSchool(id) : [] });
}
