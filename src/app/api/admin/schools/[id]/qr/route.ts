import QRCode from "qrcode";
import { requireApi } from "@/server/auth/current";
import { isUuid, notFound } from "@/server/http/responses";
import { getSchool } from "@/server/schools";
import { studentLink } from "@/lib/links";

// Ảnh QR sinh từ link mỗi lần tải, không lưu: link chứa id trường nên đổi tên trường không ảnh hưởng QR.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApi(request, "schools");
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const school = isUuid(id) ? await getSchool(id) : null;
  if (!school) return notFound();
  const png = await QRCode.toBuffer(studentLink(id), { width: 800, margin: 2, errorCorrectionLevel: "M" });
  const filename = `qr-${school.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9]+/g, "-")}.png`;
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${filename}"` } });
}
