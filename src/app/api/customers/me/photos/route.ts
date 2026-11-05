import { recordPhoto } from "@/server/customerPhotos";
import { jsonBody } from "@/server/http/responses";
import { requireStudent } from "@/server/http/student";
import { failResponse, zodFail } from "@/server/http/zod";
import { PhotoRecordForm } from "@/lib/customerForm";

export async function POST(request: Request) {
  const auth = await requireStudent(request);
  if (!auth.ok) return auth.response;
  const parsed = PhotoRecordForm.safeParse(await jsonBody(request));
  if (!parsed.success) return zodFail(parsed.error);
  const r = await recordPhoto(auth.customer, parsed.data);
  return r.ok ? new Response(null, { status: 201 }) : failResponse(r);
}
