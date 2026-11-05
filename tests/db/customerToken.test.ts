import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { TEST_NAME, cleanTestUsers, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { customers } from "../../src/server/db/schema";
import { createSchool, publicSchool, setSchoolActive } from "../../src/server/schools";
import { customerFromRequest, newCustomerToken, touchCustomer } from "../../src/server/customers";
import { SchoolForm } from "../../src/lib/schoolForm";

let schoolId: string;
let manager: Awaited<ReturnType<typeof makeActor>>;

beforeAll(async () => {
  await cleanTestUsers();
  manager = await makeActor("token_manager", "manager");
  const s = await createSchool(manager, SchoolForm.parse({ name: TEST_NAME + "THPT Token", provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" }));
  if (!s.ok) throw new Error(s.message);
  schoolId = s.id;
});
afterAll(cleanTestUsers);

const bearer = (token: string | null) => new Request("http://bank.localhost/api/customers/me", { headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe("token của học sinh", () => {
  test("token 32 byte, DB chỉ giữ băm", () => {
    const { token, tokenHash } = newCustomerToken();
    expect(Buffer.from(token, "base64url").length).toBe(32);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toContain(token);
    expect(newCustomerToken().token).not.toBe(token);
  });

  test("đọc học sinh theo Bearer token, token sai hoặc thiếu thì không ra ai", async () => {
    const { token, tokenHash } = newCustomerToken();
    const [row] = await db
      .insert(customers)
      .values({ schoolId, fullName: "HS", nameSearch: "hs", className: "11A1", phone: "0900000001", parentName: "PH", parentPhone: "0910000001", tokenHash })
      .returning({ id: customers.id });
    expect((await customerFromRequest(bearer(token)))?.id).toBe(row.id);
    expect(await customerFromRequest(bearer(token + "x"))).toBeNull();
    expect(await customerFromRequest(bearer(null))).toBeNull();
    expect(await customerFromRequest(new Request("http://x", { headers: { Authorization: tokenHash } }))).toBeNull();
  });

  test("mở web ghi last_seen_at", async () => {
    const { tokenHash } = newCustomerToken();
    const [row] = await db
      .insert(customers)
      .values({ schoolId, fullName: "HS", nameSearch: "hs", className: "11A1", phone: "0900000002", parentName: "PH", parentPhone: "0910000002", tokenHash })
      .returning({ id: customers.id });
    const before = Date.now();
    await touchCustomer(row.id);
    const [after] = await db.select({ lastSeenAt: customers.lastSeenAt }).from(customers).where(eq(customers.id, row.id));
    expect(after.lastSeenAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});

describe("trường cho web học sinh", () => {
  test("trả tên và trạng thái mở, trường đã đóng vẫn trả để web báo đóng", async () => {
    expect(await publicSchool(schoolId)).toMatchObject({ id: schoolId, name: TEST_NAME + "THPT Token", active: true });
    await setSchoolActive(manager, schoolId, false);
    expect(await publicSchool(schoolId)).toMatchObject({ active: false });
    await setSchoolActive(manager, schoolId, true);
  });

  test("id không có thì null", async () => {
    expect(await publicSchool("00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
