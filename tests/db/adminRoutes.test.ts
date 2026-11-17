import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { cleanTestUsers, makeActor } from "./helpers";
import { insertCustomer, setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { proofPhotos, vouchers } from "../../src/server/db/schema";
import { SESSION_COOKIE, createSession } from "../../src/server/auth/session";
import { POST as createUserRoute } from "../../src/app/api/admin/users/route";
import { PATCH as settingsRoute } from "../../src/app/api/admin/settings/route";
import { GET as vouchersRoute } from "../../src/app/api/admin/vouchers/route";
import { GET as customersRoute } from "../../src/app/api/admin/customers/route";
import { GET as customerExportRoute } from "../../src/app/api/admin/customers/export/route";
import { GET as customerBankExportRoute } from "../../src/app/api/admin/customer-banks/export/route";
import { GET as photoRoute } from "../../src/app/api/admin/photos/[id]/route";
import { POST as reviewRoute } from "../../src/app/api/admin/customer-banks/[id]/review/route";
import { XLSX_TYPE } from "../../src/lib/excel";

const SITE = `http://${process.env.ADMIN_HOST ?? "admin.localhost"}:3100`;
let p: Program;
const cookie: Record<string, string> = {};
let photoB: string;
let rowA: string;

const req = (path: string, who: string | null, init: { method?: string; body?: unknown; origin?: string } = {}) =>
  new Request(`${SITE}${path}`, {
    method: init.method ?? "GET",
    headers: { "Content-Type": "application/json", Origin: init.origin ?? SITE, ...(who ? { Cookie: `${SESSION_COOKIE}=${cookie[who]}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("route", ["A", "B"]);
  const staff = await makeActor("route_staff", "staff", [], [p.bank.A]);
  const exporter = await makeActor("route_exporter", "staff", ["export_excel"], [p.bank.A]);
  const lonely = await makeActor("route_lonely", "staff", ["export_excel"], []);
  for (const [k, u] of Object.entries({ staff, exporter, lonely, manager: p.manager })) cookie[k] = (await createSession(u.id)).token;
  const c = await insertCustomer(p, { fullName: "Routeds Trần Minh Anh", parentPhone: "0987654321", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }, { key: "B", status: "pending" }] });
  await db.insert(vouchers).values({ customerId: c.id, code: "ZZROUTE-TMA-11A3-AAAA" });
  rowA = c.rows.A;
  const [ph] = await db.insert(proofPhotos).values({ customerBankId: c.rows.B, slotId: p.slot.B, s3Key: `proofs/2026-11-05/${randomUUID()}.webp` }).returning({ id: proofPhotos.id });
  photoB = ph.id;
});
afterAll(cleanTestUsers);

describe("route quản lý theo quyền", () => {
  test("Nhân viên gọi route của quyền mình không có thì nhận 403", async () => {
    expect((await createUserRoute(req("/api/admin/users", "staff", { method: "POST", body: { fullName: "X", username: "zz_test_x", role: "staff", permissions: [] } }))).status).toBe(403);
    expect((await settingsRoute(req("/api/admin/settings", "staff", { method: "PATCH", body: {} }))).status).toBe(403);
    expect((await vouchersRoute(req("/api/admin/vouchers", "staff"))).status).toBe(403);
    expect((await customerExportRoute(req("/api/admin/customers/export", "staff"))).status).toBe(403);
    expect((await customersRoute(req("/api/admin/customers", "lonely"))).status).toBe(403);
    expect((await customerExportRoute(req("/api/admin/customers/export", "lonely"))).status).toBe(403);
    expect((await customerBankExportRoute(req("/api/admin/customer-banks/export", "staff"))).status).toBe(403);
    expect((await customerBankExportRoute(req("/api/admin/customer-banks/export", "lonely"))).status).toBe(403);
  });

  test("chưa đăng nhập 401, Origin của trang khác 403", async () => {
    expect((await customersRoute(req("/api/admin/customers", null))).status).toBe(401);
    expect((await reviewRoute(req(`/api/admin/customer-banks/${rowA}/review`, "staff", { method: "POST", body: { result: "passed", expected: "pending" }, origin: "http://bank.localhost:3100" }), params(rowA))).status).toBe(403);
  });

  test("ảnh của ngân hàng khác trả 404 cho Nhân viên, Quản lý xem được", async () => {
    expect((await photoRoute(req(`/api/admin/photos/${photoB}`, "staff"), params(photoB))).status).toBe(404);
    expect((await photoRoute(req(`/api/admin/photos/${photoB}`, "manager"), params(photoB))).status).toBe(302);
  });

  test("danh sách voucher không trả SĐT phụ huynh", async () => {
    const res = await vouchersRoute(req("/api/admin/vouchers?q=routeds", "manager"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows.length).toBe(1);
    expect(Object.keys(body.rows[0]).sort()).toEqual(["className", "code", "customerId", "fullName", "id", "issuedAt", "schoolName", "smsStatus"]);
    expect(JSON.stringify(body)).not.toMatch(/phone|0987654321/i);
  });

  test("người có quyền Xuất Excel tải được file", async () => {
    const res = await customerExportRoute(req("/api/admin/customers/export?q=routeds", "exporter"));
    expect([res.status, res.headers.get("content-type")]).toEqual([200, XLSX_TYPE]);
    const banks = await customerBankExportRoute(req("/api/admin/customer-banks/export?q=routeds", "exporter"));
    expect([banks.status, banks.headers.get("content-type")]).toEqual([200, XLSX_TYPE]);
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="ho-so-hoc-sinh-/);
  });
});
