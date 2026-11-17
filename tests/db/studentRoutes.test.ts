import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { TEST_NAME, cleanTestUsers, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { customers } from "../../src/server/db/schema";
import { createSchool } from "../../src/server/schools";
import { createCustomer } from "../../src/server/customers";
import { CustomerForm } from "../../src/lib/customerForm";
import { SchoolForm } from "../../src/lib/schoolForm";
import { POST as createRoute } from "../../src/app/api/customers/route";
import { POST as reserveRoute } from "../../src/app/api/customers/me/banks/route";
import { POST as photosRoute } from "../../src/app/api/customers/me/photos/route";
import { GET as meRoute } from "../../src/app/api/customers/me/route";

const SITE = `http://${process.env.STUDENT_HOST ?? "bank.localhost"}:3100`;
let token: string;
let schoolId: string;

const req = (path: string, { origin = SITE, auth, body }: { origin?: string; auth?: string; body?: unknown } = {}) =>
  new Request(`${SITE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin, ...(auth ? { Authorization: auth } : {}) },
    body: JSON.stringify(body ?? {}),
  });

const photoReq = (body: FormData, auth?: string, headers: Record<string, string> = {}) =>
  new Request(`${SITE}/api/customers/me/photos`, { method: "POST", headers: { Origin: SITE, ...(auth ? { Authorization: auth } : {}), ...headers }, body });

beforeAll(async () => {
  await cleanTestUsers();
  const manager = await makeActor("route_manager", "manager");
  const s = await createSchool(manager, SchoolForm.parse({ name: TEST_NAME + "THPT Route", provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" }));
  if (!s.ok) throw new Error(s.message);
  schoolId = s.id;
  const c = await createCustomer(
    CustomerForm.parse({ schoolId, fullName: "Học Sinh Route", className: "10A1", parentPhone: "0910000601", consent: true, existingBankIds: [] }),
    null,
  );
  if (!c.ok) throw new Error(c.message);
  token = c.token;
});
afterAll(cleanTestUsers);

describe("route ghi của học sinh", () => {
  test("thiếu Bearer hoặc Bearer sai thì 401", async () => {
    expect((await reserveRoute(req("/api/customers/me/banks", { body: { bankIds: [schoolId] } }))).status).toBe(401);
    expect((await reserveRoute(req("/api/customers/me/banks", { auth: "Bearer " + "x".repeat(43), body: { bankIds: [schoolId] } }))).status).toBe(401);
    expect((await photosRoute(photoReq(new FormData(), token))).status).toBe(401);
    expect((await meRoute(new Request(`${SITE}/api/customers/me`))).status).toBe(401);
  });

  test("token đúng nhưng Origin của trang khác thì 403", async () => {
    expect((await reserveRoute(req("/api/customers/me/banks", { origin: "http://evil.example", auth: `Bearer ${token}`, body: { bankIds: [schoolId] } }))).status).toBe(403);
    expect((await reserveRoute(req("/api/customers/me/banks", { origin: "http://admin.localhost:3100", auth: `Bearer ${token}`, body: { bankIds: [schoolId] } }))).status).toBe(403);
  });

  test("tạo hồ sơ từ trang khác thì 403", async () => {
    const body = { schoolId, fullName: "A", className: "10A1", parentPhone: "0910000602", consent: true, existingBankIds: [] };
    expect((await createRoute(req("/api/customers", { origin: "http://evil.example", body }))).status).toBe(403);
  });

  test("token đúng, cùng trang thì qua được bước xác thực", async () => {
    const res = await meRoute(new Request(`${SITE}/api/customers/me`, { headers: { Authorization: `Bearer ${token}` } }));
    expect(res.status).toBe(200);
  });

  test("hồ sơ mới ghi IP cuối của X-Forwarded-For (địa chỉ Nginx ghi), không ghi địa chỉ học sinh tự khai ở đầu", async () => {
    const body = { schoolId, fullName: "Học Sinh IP", className: "10A1", parentPhone: "0910000603", consent: true, existingBankIds: [] };
    const request = req("/api/customers", { body });
    request.headers.set("X-Forwarded-For", "6.6.6.6, 203.0.113.9");
    expect((await createRoute(request)).status).toBeLessThan(300);
    const [row] = await db.select({ ip: customers.createdIp }).from(customers).where(eq(customers.parentPhone, "0910000603"));
    expect(row.ip).toBe("203.0.113.9");
  });
});

describe("route nộp ảnh nhận multipart", () => {
  const UUID = "3f2b9c1e-8a4d-4f6b-9c2e-1a2b3c4d5e6f";
  const form = (fields: Record<string, string | Blob>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, v);
    return f;
  };

  test("Content-Length quá 22 MB thì 413 trước khi đọc body", async () => {
    const res = await photosRoute(photoReq(form({ customerBankId: UUID, slotId: UUID }), `Bearer ${token}`, { "content-length": String(23 * 1024 * 1024) }));
    expect(res.status).toBe(413);
    expect((await res.json()).message).toBe("Ảnh lớn hơn 20 MB.");
  });

  test("thiếu file hoặc khung ảnh sai thì 400 và chỉ đúng ô", async () => {
    const noFile = await photosRoute(photoReq(form({ customerBankId: UUID, slotId: UUID }), `Bearer ${token}`));
    expect([noFile.status, (await noFile.json()).field]).toEqual([400, "file"]);
    const badSlot = await photosRoute(photoReq(form({ customerBankId: UUID, slotId: "x", file: new Blob([new Uint8Array([1])]) }), `Bearer ${token}`));
    expect([badSlot.status, (await badSlot.json()).field]).toEqual([400, "slotId"]);
  });

  test("file 0 byte thì 400 báo file rỗng như mgst-app, không báo Chọn ảnh", async () => {
    const res = await photosRoute(photoReq(form({ customerBankId: UUID, slotId: UUID, file: new Blob([]) }), `Bearer ${token}`));
    expect([res.status, await res.json()]).toEqual([400, { message: "File rỗng.", field: "file" }]);
  });

  test("body không phải multipart thì 400", async () => {
    const res = await photosRoute(new Request(`${SITE}/api/customers/me/photos`, { method: "POST", headers: { Origin: SITE, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}" }));
    expect(res.status).toBe(400);
  });

  test("hồ sơ chưa chọn ngân hàng thì 409, không ghi S3", async () => {
    const res = await photosRoute(photoReq(form({ customerBankId: UUID, slotId: UUID, file: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])]) }), `Bearer ${token}`));
    expect(res.status).toBe(409);
  });
});
