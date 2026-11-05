import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { cleanTestUsers, makeActor } from "./helpers";
import { insertCustomer, setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { hostMetrics, photoChecks, sessions } from "../../src/server/db/schema";
import { createSession, hashToken } from "../../src/server/auth/session";
import { cleanupOps, opsSummary, recordHostMetrics } from "../../src/server/ops";
import type { SessionUser } from "../../src/lib/types";

let admin: SessionUser;
let p: Program;
const metricIds: number[] = [];
const hour = 3_600_000;
const day = 24 * hour;

async function metric(at: Date, s3?: { bytes: number; objects: number }) {
  const [row] = await db
    .insert(hostMetrics)
    .values({ at, cpuPercent: "23.40", ramUsed: 3, ramTotal: 8, diskUsed: 30, diskTotal: 80, s3Bytes: s3?.bytes ?? null, s3Objects: s3?.objects ?? null, s3At: s3 ? at : null })
    .returning({ id: hostMetrics.id });
  metricIds.push(row.id);
  return row.id;
}

async function check(customerBankId: string, status: "pending" | "done" | "failed", passed: number, total: number, createdAt: Date) {
  await db.insert(photoChecks).values({ customerBankId, status, passed, total, createdAt, checkedAt: status === "pending" ? null : createdAt, error: status === "failed" ? "OCR lỗi" : "" });
}

beforeAll(async () => {
  await cleanTestUsers();
  admin = await makeActor("ops_admin", "admin");
  p = await setupProgram("ops", ["A", "B"]);
});
afterAll(async () => {
  if (metricIds.length) await db.delete(hostMetrics).where(inArray(hostMetrics.id, metricIds));
  await cleanTestUsers();
});

describe("Trang Vận hành hệ thống", () => {
  test("chỉ Quản trị đọc được, người khác nhận 404", async () => {
    expect(await opsSummary(p.manager)).toMatchObject({ ok: false, status: 404 });
    expect((await opsSummary(admin)).ok).toBe(true);
  });

  test("hiện số đo mới nhất; S3 lấy từ lượt đo S3 gần nhất vì S3 chỉ đo mỗi giờ", async () => {
    const now = Date.now();
    await metric(new Date(now + 3 * hour), { bytes: 61 * 1024 ** 3, objects: 184320 });
    await metric(new Date(now + 4 * hour));
    const r = await opsSummary(admin);
    if (!r.ok) throw new Error(r.message);
    expect(r.host?.at.getTime()).toBe(now + 4 * hour);
    expect(r.host).toMatchObject({ cpuPercent: 23.4, ramUsed: 3, ramTotal: 8, diskUsed: 30, diskTotal: 80 });
    expect(r.host?.s3).toEqual({ bytes: 61 * 1024 ** 3, objects: 184320, at: new Date(now + 3 * hour) });
  });

  test("ops-watch ghi một dòng số đo, lượt không đo S3 để trống ba cột S3", async () => {
    const id = await recordHostMetrics({ cpuPercent: 12.345, ram: { used: 1, total: 2 }, disk: { used: 3, total: 4 }, s3: null });
    metricIds.push(id);
    const [row] = await db.select().from(hostMetrics).where(eq(hostMetrics.id, id));
    expect(row).toMatchObject({ cpuPercent: "12.35", ramUsed: 1, ramTotal: 2, diskUsed: 3, diskTotal: 4, s3Bytes: null, s3Objects: null, s3At: null });
  });

  test("kiểm ảnh theo ngân hàng: mỗi dòng ngân hàng tính lượt mới nhất trong 7 ngày, lượt đang đợi tính cả lượt cũ", async () => {
    const now = Date.now();
    const banks = (keys: string[]) => keys.map((key) => ({ key, status: "pending" as const }));
    const c1 = await insertCustomer(p, { fullName: "Ops Một", status: "pending_review", banks: banks(["A"]) });
    await check(c1.rows.A, "done", 2, 2, new Date(now - 3 * day));
    await check(c1.rows.A, "done", 1, 2, new Date(now - day));
    const c2 = await insertCustomer(p, { fullName: "Ops Hai", status: "pending_review", banks: banks(["A"]) });
    await check(c2.rows.A, "failed", 0, 0, new Date(now - hour));
    const c3 = await insertCustomer(p, { fullName: "Ops Ba", status: "pending_review", banks: banks(["A"]) });
    await check(c3.rows.A, "done", 2, 2, new Date(now - 10 * day));
    const c4 = await insertCustomer(p, { fullName: "Ops Bốn", status: "pending_review", banks: banks(["B"]) });
    await check(c4.rows.B, "pending", 0, 0, new Date("2000-01-01T00:00:00Z"));
    const c5 = await insertCustomer(p, { fullName: "Ops Năm", status: "pending_review", banks: banks(["B"]) });
    await check(c5.rows.B, "done", 1, 1, new Date(now - hour));

    const r = await opsSummary(admin);
    if (!r.ok) throw new Error(r.message);
    const row = (key: string) => r.photoCheck.banks.find((b) => b.bankId === p.bank[key]);
    expect(row("A")).toMatchObject({ name: "ZZTEST ops A", pending: 0, passed: 0, failed: 1, error: 1 });
    expect(row("B")).toMatchObject({ name: "ZZTEST ops B", pending: 1, passed: 1, failed: 0, error: 0 });
    expect(r.photoCheck.oldestPendingAt).toEqual(new Date("2000-01-01T00:00:00Z"));
    expect(r.photoCheck.pending).toBeGreaterThanOrEqual(1);
  });

  test("số lượt đang đợi đếm cả hệ thống", async () => {
    const before = await opsSummary(admin);
    if (!before.ok) throw new Error(before.message);
    const c = await insertCustomer(p, { fullName: "Ops Sáu", status: "pending_review", banks: [{ key: "A", status: "pending" }] });
    await check(c.rows.A, "pending", 0, 0, new Date());
    const after = await opsSummary(admin);
    if (!after.ok) throw new Error(after.message);
    expect(after.photoCheck.pending).toBe(before.photoCheck.pending + 1);
  });
});

describe("dọn của ops-watch", () => {
  test("xoá số đo cũ hơn 7 ngày và phiên đã hết hạn, giữ phần còn lại", async () => {
    const now = Date.now();
    const old = await metric(new Date(now - 8 * day));
    const recent = await metric(new Date(now - 6 * day));
    const live = await createSession(admin.id);
    const dead = await createSession(admin.id);
    await db.update(sessions).set({ expiresAt: new Date(now - 1000) }).where(eq(sessions.tokenHash, hashToken(dead.token)));

    const r = await cleanupOps();
    expect(r.metrics).toBeGreaterThanOrEqual(1);
    expect(r.sessions).toBeGreaterThanOrEqual(1);
    const left = (await db.select({ id: hostMetrics.id }).from(hostMetrics).where(inArray(hostMetrics.id, [old, recent]))).map((x) => x.id);
    expect(left).toEqual([recent]);
    const tokens = (await db.select({ h: sessions.tokenHash }).from(sessions).where(eq(sessions.userId, admin.id))).map((x) => x.h);
    expect(tokens).toContain(hashToken(live.token));
    expect(tokens).not.toContain(hashToken(dead.token));
  });
});
