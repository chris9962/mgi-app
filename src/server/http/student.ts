import { configuredHosts, sameOrigin } from "@/lib/hosts";
import { customerFromRequest, type Customer } from "../customers";
import { forbidden } from "./responses";

export const studentUnauthorized = () => Response.json({ message: "Không tìm thấy hồ sơ trên máy này." }, { status: 401 });

// Token đi trong header nên trang khác không gửi thay được; vẫn kiểm Origin để chặn form của trang lạ tạo hồ sơ rác.
export const fromStudentSite = (request: Request) => sameOrigin(request, configuredHosts().student);

export async function requireStudent(request: Request): Promise<{ ok: true; customer: Customer } | { ok: false; response: Response }> {
  if (!fromStudentSite(request)) return { ok: false, response: forbidden() };
  const customer = await customerFromRequest(request);
  return customer ? { ok: true, customer } : { ok: false, response: studentUnauthorized() };
}
