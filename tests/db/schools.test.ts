import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { TEST_NAME, cleanTestUsers, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { auditLog, schools } from "../../src/server/db/schema";
import { createSchool, listSchools, searchSchoolOptions, setSchoolActive, updateSchool } from "../../src/server/schools";
import { SchoolForm } from "../../src/lib/schoolForm";
import type { SessionUser } from "../../src/lib/types";

const form = (name: string, extra: Record<string, string> = {}) =>
  SchoolForm.parse({ name: TEST_NAME + name, provinceCode: "80", wardCode: "25585", contactName: "Lê Thu Hương", contactPhone: "0903111222", ...extra });

let actor: SessionUser;
beforeAll(async () => {
  await cleanTestUsers();
  actor = await makeActor("school_admin", "staff", ["schools"]);
});
afterAll(cleanTestUsers);

describe("trường", () => {
  test("tạo trường rồi tìm được theo tên trường và tên xã", async () => {
    const r = await createSchool(actor, form("THPT Nguyễn Du"));
    if (!r.ok) throw new Error(r.message);
    const byName = await listSchools({ q: TEST_NAME + "THPT Nguyễn", page: 1 });
    expect(byName.rows.map((x) => x.id)).toContain(r.id);
    const row = byName.rows.find((x) => x.id === r.id)!;
    expect(row.wardName).toBe("Xã Châu Thành");
    expect(row.provinceName).toBe("Tỉnh Tây Ninh");
    expect(row.customerCount).toBe(0);
    const byWard = await listSchools({ q: "Châu Thành", page: 1 });
    expect(byWard.total).toBeGreaterThanOrEqual(1);
  });

  test("xã không thuộc tỉnh đã chọn bị từ chối", async () => {
    const r = await createSchool(actor, form("Sai xã", { provinceCode: "01" }));
    expect(r).toMatchObject({ ok: false, field: "wardCode" });
  });

  test("sửa, đóng trường và ghi audit_log", async () => {
    const r = await createSchool(actor, form("Sửa"));
    if (!r.ok) throw new Error(r.message);
    expect((await updateSchool(actor, r.id, form("Đã sửa"))).ok).toBe(true);
    expect((await setSchoolActive(actor, r.id, false)).ok).toBe(true);
    const [row] = await db.select().from(schools).where(eq(schools.id, r.id));
    expect(row.name).toBe(TEST_NAME + "Đã sửa");
    expect(row.active).toBe(false);
    const actions = (await db.select({ a: auditLog.action }).from(auditLog).where(and(eq(auditLog.userId, actor.id), eq(auditLog.targetId, r.id)))).map((x) => x.a);
    expect(actions.sort()).toEqual(["close_school", "create_school", "update_school"]);
  });

  test("ô chọn trường ghi tên kèm tên xã, bỏ trường đã đóng", async () => {
    const options = await searchSchoolOptions(TEST_NAME);
    const labels = options.map((o) => o.label);
    expect(labels).toContain(`${TEST_NAME}THPT Nguyễn Du - Châu Thành`);
    expect(labels.some((l) => l.includes("Đã sửa"))).toBe(false);
  });
});
