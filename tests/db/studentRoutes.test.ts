import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TEST_NAME, cleanTestUsers, makeActor } from "./helpers";
import { createSchool } from "../../src/server/schools";
import { createCustomer } from "../../src/server/customers";
import { CustomerForm } from "../../src/lib/customerForm";
import { SchoolForm } from "../../src/lib/schoolForm";
import { POST as createRoute } from "../../src/app/api/customers/route";
import { POST as reserveRoute } from "../../src/app/api/customers/me/banks/route";
import { POST as uploadUrlRoute } from "../../src/app/api/customers/me/photos/upload-url/route";
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

beforeAll(async () => {
  await cleanTestUsers();
  const manager = await makeActor("route_manager", "manager");
  const s = await createSchool(manager, SchoolForm.parse({ name: TEST_NAME + "THPT Route", provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" }));
  if (!s.ok) throw new Error(s.message);
  schoolId = s.id;
  const c = await createCustomer(
    CustomerForm.parse({ schoolId, fullName: "Học Sinh Route", className: "10A1", phone: "0900000601", parentName: "Phụ Huynh", parentPhone: "0910000601", existingBankIds: [] }),
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
    expect((await uploadUrlRoute(req("/api/customers/me/photos/upload-url", { auth: token, body: {} }))).status).toBe(401);
    expect((await meRoute(new Request(`${SITE}/api/customers/me`))).status).toBe(401);
  });

  test("token đúng nhưng Origin của trang khác thì 403", async () => {
    expect((await reserveRoute(req("/api/customers/me/banks", { origin: "http://evil.example", auth: `Bearer ${token}`, body: { bankIds: [schoolId] } }))).status).toBe(403);
    expect((await reserveRoute(req("/api/customers/me/banks", { origin: "http://admin.localhost:3100", auth: `Bearer ${token}`, body: { bankIds: [schoolId] } }))).status).toBe(403);
  });

  test("tạo hồ sơ từ trang khác thì 403", async () => {
    const body = { schoolId, fullName: "A", className: "10A1", phone: "0900000602", parentName: "B", parentPhone: "0910000602", existingBankIds: [] };
    expect((await createRoute(req("/api/customers", { origin: "http://evil.example", body }))).status).toBe(403);
  });

  test("token đúng, cùng trang thì qua được bước xác thực", async () => {
    const res = await meRoute(new Request(`${SITE}/api/customers/me`, { headers: { Authorization: `Bearer ${token}` } }));
    expect(res.status).toBe(200);
  });
});
