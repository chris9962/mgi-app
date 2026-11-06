import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { and, eq } from "drizzle-orm";
import { cleanTestUsers, makeActor } from "./helpers";
import { insertCustomer, setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { auditLog, smsMessages } from "../../src/server/db/schema";
import { failedSmsCount, listSms, queuedSmsIds, resendSms, runSmsQueue, sendOneSms } from "../../src/server/sms/queue";
import { parseSmsFilters } from "../../src/lib/smsFilters";
import type { SmsSender } from "../../src/server/sms/send";
import type { SessionUser } from "../../src/lib/types";

let p: Program;
let staffA: SessionUser;
let staffB: SessionUser;

async function queued(fullName = "Smsds Trần Minh Anh", bank = "A", status: "queued" | "sent" | "failed" = "queued", attempts = 0, program = p) {
  const c = await insertCustomer(program, { fullName, parentPhone: "0987654321", status: "reviewed", submittedAt: new Date(), banks: [{ key: bank, status: "passed" }] });
  const [row] = await db.insert(smsMessages).values({ customerId: c.id, kind: "voucher", toPhone: "0987654321", body: "TRAN MINH ANH da mo tai khoan", status, attempts, error: status === "failed" ? "Số không tồn tại" : "" }).returning();
  return row;
}

const smsRow = async (id: string) => (await db.select().from(smsMessages).where(eq(smsMessages.id, id)))[0];
const ok: SmsSender = async () => ({ ok: true, providerMessageId: "prov-1" });
const broken: SmsSender = async () => ({ ok: false, error: "Nhà mạng từ chối" });

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("sms", ["A", "B"]);
  staffA = await makeActor("sms_staff_a", "staff", [], [p.bank.A]);
  staffB = await makeActor("sms_staff_b", "staff", [], [p.bank.B]);
});
afterAll(cleanTestUsers);

describe("worker SMS", () => {
  test("gửi tin queued: sang sent, ghi giờ gửi, số lần gửi, mã nhà cung cấp", async () => {
    const s = await queued();
    expect(await queuedSmsIds()).toContain(s.id);
    const sent: string[] = [];
    expect(await sendOneSms(s.id, async (to, body) => (sent.push(`${to}|${body}`), { ok: true, providerMessageId: "prov-1" }))).toBe("sent");
    expect(sent).toEqual(["0987654321|TRAN MINH ANH da mo tai khoan"]);
    const row = await smsRow(s.id);
    expect([row.status, row.attempts, row.providerMessageId, row.sentAt !== null]).toEqual(["sent", 1, "prov-1", true]);
    expect(await queuedSmsIds()).not.toContain(s.id);
  });

  test("lỗi thì giữ queued để thử lại, lỗi lần thứ 3 thì sang failed và không gửi nữa", async () => {
    const s = await queued();
    expect(await sendOneSms(s.id, broken)).toBe("retry");
    expect([(await smsRow(s.id)).status, (await smsRow(s.id)).attempts, (await smsRow(s.id)).error]).toEqual(["queued", 1, "Nhà mạng từ chối"]);
    expect(await sendOneSms(s.id, async () => Promise.reject(new Error("Hết thời gian chờ")))).toBe("retry");
    expect((await smsRow(s.id)).error).toBe("Hết thời gian chờ");
    expect(await sendOneSms(s.id, broken)).toBe("failed");
    expect([(await smsRow(s.id)).status, (await smsRow(s.id)).attempts]).toEqual(["failed", 3]);
    let called = false;
    expect(await sendOneSms(s.id, async () => ((called = true), { ok: true, providerMessageId: null }))).toBe("skipped");
    expect(called).toBe(false);
    expect(await queuedSmsIds()).not.toContain(s.id);
  });

  test("hai worker cùng lấy một tin: chỉ một bên gửi", async () => {
    const s = await queued();
    let calls = 0;
    const slow: SmsSender = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 150));
      return { ok: true, providerMessageId: null };
    };
    const results = await Promise.all([sendOneSms(s.id, slow), sendOneSms(s.id, slow)]);
    expect(calls).toBe(1);
    expect(results.sort()).toEqual(["sent", "skipped"]);
    expect((await smsRow(s.id)).attempts).toBe(1);
  });
});

describe("Gửi lại", () => {
  test("tin lỗi về queued, attempts về 0, đổi được SĐT nhận, ghi audit, báo worker", async () => {
    const s = await queued("Smsds Lê Hoàng Nam", "A", "failed", 3);
    expect(await resendSms(staffA, s.id, "0912 000 111", null)).toEqual({ ok: true });
    const row = await smsRow(s.id);
    expect([row.status, row.attempts, row.error, row.toPhone]).toEqual(["queued", 0, "", "0912000111"]);
    const [a] = await db.select().from(auditLog).where(and(eq(auditLog.action, "resend_sms"), eq(auditLog.targetId, s.id)));
    expect(a.detail).toEqual({ before: "0987654321", after: "0912000111" });
    expect(await sendOneSms(s.id, ok)).toBe("sent");
  });

  test("ngoài phạm vi trả 404, tin chưa lỗi trả 409, SĐT sai trả 400", async () => {
    const s = await queued("Smsds Lê Hoàng Nam", "A", "failed", 3);
    expect(await resendSms(staffB, s.id, "0987654321", null)).toMatchObject({ ok: false, status: 404 });
    expect(await resendSms(staffA, s.id, "12345", null)).toMatchObject({ ok: false, status: 400, field: "toPhone" });
    const sent = await queued("Smsds Lê Hoàng Nam", "A", "sent", 1);
    expect(await resendSms(staffA, sent.id, "0987654321", null)).toMatchObject({ ok: false, status: 409 });
  });
});

describe("Trang Tin SMS lỗi", () => {
  test("mặc định chỉ tin lỗi trong phạm vi người xem; số trên sidebar đếm cùng phạm vi", async () => {
    await queued("Smslist Phạm Thu Hà", "A", "failed", 3);
    await queued("Smslist Võ Kim Ngân", "B", "failed", 3);
    await queued("Smslist Nguyễn Gia Bảo", "A", "sent", 1);
    const names = async (actor: SessionUser, sp: Record<string, string>) => (await listSms(actor, parseSmsFilters(sp), 1)).rows.map((r) => r.fullName).sort();
    expect(await names(staffA, { q: "smslist" })).toEqual(["Smslist Phạm Thu Hà"]);
    expect(await names(p.manager, { q: "smslist" })).toEqual(["Smslist Phạm Thu Hà", "Smslist Võ Kim Ngân"]);
    expect(await names(p.manager, { q: "smslist", status: "all" })).toEqual(["Smslist Nguyễn Gia Bảo", "Smslist Phạm Thu Hà", "Smslist Võ Kim Ngân"]);
    expect(await names(p.manager, { q: "smslist vo kim" })).toEqual(["Smslist Võ Kim Ngân"]);
    const [row] = (await listSms(staffA, parseSmsFilters({ q: "smslist" }), 1)).rows;
    expect([row.toPhone, row.error, row.attempts, row.status, row.schoolName]).toEqual(["0987654321", "Số không tồn tại", 3, "failed", p.schoolName]);
    const before = await failedSmsCount(staffB);
    await queued("Smslist Thêm", "B", "failed", 3);
    expect(await failedSmsCount(staffB)).toBe(before + 1);
    expect(await failedSmsCount(staffA)).toBeGreaterThanOrEqual(1);
  });
});

describe("worker SMS chỉ gửi tin của trường được chỉ", () => {
  let other: Program;
  const worker = (...args: string[]) => spawn("bun", ["scripts/sms-worker.ts", ...args], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  const exited = (child: ReturnType<typeof worker>) => new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));

  beforeAll(async () => {
    other = await setupProgram("smsother", ["C"]);
  });

  test("runSmsQueue có danh sách trường thì tin trường khác vẫn chờ, chưa gửi lần nào", async () => {
    const mine = await queued("Smsscope Mai Anh");
    const theirs = await queued("Smsscope Khác Trường", "C", "queued", 0, other);
    await runSmsQueue(ok, [p.schoolId]);
    expect((await smsRow(mine.id)).status).toBe("sent");
    expect([(await smsRow(theirs.id)).status, (await smsRow(theirs.id)).attempts]).toEqual(["queued", 0]);
  });

  test("--mot-vong --truong gửi tin đang chờ của trường đó, ghi log rồi thoát mã 0", async () => {
    const mine = await queued("Smsworker Lan Anh");
    const theirs = await queued("Smsworker Khác Trường", "C", "queued", 0, other);
    const child = worker("--mot-vong", `--truong=${p.schoolId}`);
    let out = "";
    child.stdout!.on("data", (d) => (out += d));
    expect(await exited(child)).toBe(0);
    expect((await smsRow(mine.id)).status).toBe("sent");
    expect(out).toContain("[sms] tới 0987654321");
    expect((await smsRow(theirs.id)).status).toBe("queued");
  }, 30_000);

  test("cờ --truong sai thì thoát lỗi, không gửi tin nào", async () => {
    const mine = await queued("Smsworker Cờ Sai");
    expect(await exited(worker("--mot-vong", "--truong=abc"))).not.toBe(0);
    expect((await smsRow(mine.id)).status).toBe("queued");
  }, 30_000);
});
