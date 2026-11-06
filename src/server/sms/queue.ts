import { and, asc, count, desc, eq, inArray, like, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db/client";
import { customers, schools, smsMessages } from "../db/schema";
import { writeAudit } from "../audit";
import { customerWhere } from "../customerList";
import { containsPattern, likeEachTerm, phoneDigits } from "../search";
import { sendSms, type SmsResult, type SmsSender } from "./send";
import { parseCustomerFilters } from "@/lib/customerFilters";
import type { SmsFilters, SmsStatus } from "@/lib/smsFilters";
import type { SessionUser } from "@/lib/types";

export const PAGE_SIZE = 15;
export const MAX_ATTEMPTS = 3;

type Fail = { ok: false; message: string; status: 400 | 404 | 409; field?: string };
const fail = (message: string, status: Fail["status"], field?: string): Fail => ({ ok: false, message, status, field });

// Worker chạy với cờ --truong chỉ gửi tin của hồ sơ thuộc các trường đó: e2e không gửi tin của hồ sơ thật trong DB local.
const ofSchools = (schoolIds?: string[]): SQL | undefined =>
  schoolIds === undefined ? undefined : schoolIds.length ? inArray(smsMessages.customerId, db.select({ id: customers.id }).from(customers).where(inArray(customers.schoolId, schoolIds))) : sql`false`;

export async function queuedSmsIds(limit = 20, schoolIds?: string[]): Promise<string[]> {
  const rows = await db
    .select({ id: smsMessages.id })
    .from(smsMessages)
    .where(and(eq(smsMessages.status, "queued"), lt(smsMessages.attempts, MAX_ATTEMPTS), ofSchools(schoolIds)))
    .orderBy(asc(smsMessages.createdAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

export type SendOutcome = "sent" | "retry" | "failed" | "skipped";

// Khoá dòng trong lúc gửi: worker khác chạy cùng lúc bỏ qua dòng đang khoá (skip locked), mỗi tin chỉ một bên gửi.
export async function sendOneSms(id: string, send: SmsSender = sendSms): Promise<SendOutcome> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(smsMessages)
      .where(and(eq(smsMessages.id, id), eq(smsMessages.status, "queued"), lt(smsMessages.attempts, MAX_ATTEMPTS)))
      .for("update", { skipLocked: true });
    if (!row) return "skipped";
    const result: SmsResult = await send(row.toPhone, row.body).catch((e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));
    const attempts = row.attempts + 1;
    if (result.ok) {
      await tx.update(smsMessages).set({ status: "sent", attempts, sentAt: new Date(), providerMessageId: result.providerMessageId, error: "" }).where(eq(smsMessages.id, id));
      return "sent";
    }
    const outcome = attempts >= MAX_ATTEMPTS ? "failed" : "retry";
    await tx
      .update(smsMessages)
      .set({ status: outcome === "failed" ? "failed" : "queued", attempts, error: result.error.slice(0, 500) })
      .where(eq(smsMessages.id, id));
    return outcome;
  });
}

// Một vòng của worker: mỗi tin đang chờ gửi một lần; tin lỗi chờ vòng sau mới thử lại.
export async function runSmsQueue(send: SmsSender = sendSms, schoolIds?: string[]): Promise<Record<SendOutcome, number>> {
  const tally: Record<SendOutcome, number> = { sent: 0, retry: 0, failed: 0, skipped: 0 };
  for (const id of await queuedSmsIds(20, schoolIds)) tally[await sendOneSms(id, send)] += 1;
  return tally;
}

// Tin thuộc phạm vi người xem khi hồ sơ của tin nằm trong phạm vi đó.
const scopeOf = (actor: SessionUser) => customerWhere(actor, parseCustomerFilters({}));

export type SmsRow = { id: string; customerId: string; fullName: string; schoolName: string; toPhone: string; error: string; attempts: number; status: SmsStatus; createdAt: Date; sentAt: Date | null };

function smsWhere(actor: SessionUser, f: SmsFilters): SQL | undefined {
  const digits = f.q ? phoneDigits(f.q) : null;
  return and(
    scopeOf(actor),
    f.status === "all" ? undefined : eq(smsMessages.status, f.status),
    f.q
      ? digits
        ? or(like(smsMessages.toPhone, containsPattern(digits)), like(customers.parentPhone, containsPattern(digits)))
        : likeEachTerm(customers.nameSearch, f.q)
      : undefined,
  );
}

export async function listSms(actor: SessionUser, f: SmsFilters, page: number): Promise<{ rows: SmsRow[]; total: number; page: number }> {
  const where = smsWhere(actor, f);
  const [{ total }] = await db.select({ total: count() }).from(smsMessages).innerJoin(customers, eq(customers.id, smsMessages.customerId)).where(where);
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const rows = await db
    .select({
      id: smsMessages.id,
      customerId: smsMessages.customerId,
      fullName: customers.fullName,
      schoolName: schools.name,
      toPhone: smsMessages.toPhone,
      error: smsMessages.error,
      attempts: smsMessages.attempts,
      status: smsMessages.status,
      createdAt: smsMessages.createdAt,
      sentAt: smsMessages.sentAt,
    })
    .from(smsMessages)
    .innerJoin(customers, eq(customers.id, smsMessages.customerId))
    .innerJoin(schools, eq(schools.id, customers.schoolId))
    .where(where)
    .orderBy(desc(smsMessages.createdAt), desc(smsMessages.id))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);
  return { rows, total, page: safePage };
}

export async function failedSmsCount(actor: SessionUser): Promise<number> {
  const [{ n }] = await db
    .select({ n: count() })
    .from(smsMessages)
    .innerJoin(customers, eq(customers.id, smsMessages.customerId))
    .where(and(eq(smsMessages.status, "failed"), scopeOf(actor)));
  return n;
}

// Gửi lại đặt attempts về 0: check của DB chỉ cho tối đa 3 lần, không đặt lại thì worker không gửi được nữa.
export async function resendSms(actor: SessionUser, id: string, rawPhone: string, ip: string | null): Promise<{ ok: true } | Fail> {
  const toPhone = rawPhone.replace(/[\s.]/g, "");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ status: smsMessages.status, toPhone: smsMessages.toPhone })
      .from(smsMessages)
      .innerJoin(customers, eq(customers.id, smsMessages.customerId))
      .where(and(eq(smsMessages.id, id), scopeOf(actor)))
      .for("update", { of: smsMessages });
    if (!row) return fail("Không tìm thấy tin SMS.", 404);
    if (!/^0[0-9]{9}$/.test(toPhone)) return fail("SĐT phải có 10 số, bắt đầu bằng 0.", 400, "toPhone");
    if (row.status !== "failed") return fail("Tin này không ở trạng thái lỗi.", 409);
    await tx.update(smsMessages).set({ status: "queued", attempts: 0, error: "", toPhone }).where(eq(smsMessages.id, id));
    await tx.execute(sql`select pg_notify('sms_messages', ${id})`);
    await writeAudit(tx, { userId: actor.id, action: "resend_sms", targetType: "sms_messages", targetId: id, detail: { before: row.toPhone, after: toPhone }, ip });
    return { ok: true as const };
  });
}
