import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "./db/client";
import { banks, referralCodeMonths, referralCodeSchools, referralCodes, users } from "./db/schema";
import { writeAudit } from "./audit";
import { schoolLabels } from "./schools";
import { can, canManageBank } from "@/lib/permissions";
import { currentYearMonth } from "@/lib/month";
import type { SessionUser } from "@/lib/types";
import type { CodeFormValues } from "@/lib/codeForm";

export const PAGE_SIZE = 15;

export type CodeStatus = "open" | "full" | "stopped";

export type CodeRow = {
  id: string;
  bankId: string;
  bankName: string;
  displayName: string;
  code: string | null;
  qrKey: string | null;
  openUrl: string | null;
  priority: number;
  monthlyQuota: number;
  active: boolean;
  quota: number;
  used: number;
  passed: number;
  holding: number;
  failed: number;
  status: CodeStatus;
  createdByName: string | null;
  schools: { id: string; label: string }[];
};

type Fail = { ok: false; message: string; field?: string; status: 400 | 404 | 409 };
const fail = (message: string, status: Fail["status"], field?: string): Fail => ({ ok: false, message, status, field });

// Câu đếm con ghi rõ "referral_codes"."id", không để Drizzle in "id" trần trỏ nhầm sang bảng con.
const CODE_ID = sql.raw(`"referral_codes"."id"`);
const countWhere = (month: string, statuses: string[]) =>
  sql<number>`(select count(*)::int from customer_banks cb where cb.referral_code_id = ${CODE_ID} and cb.year_month = ${month} and cb.status in (${sql.join(
    statuses.map((s) => sql`${s}`),
    sql`, `,
  )}))`;

const scopeOf = (actor: SessionUser) => (can(actor, "manage_banks") ? undefined : inArray(referralCodes.bankId, actor.managedBankIds.length ? actor.managedBankIds : ["00000000-0000-0000-0000-000000000000"]));

export async function listCodes(
  actor: SessionUser,
  { month, q, bankId, hideStopped, page }: { month: string; q: string; bankId: string; hideStopped: boolean; page: number },
): Promise<{ rows: CodeRow[]; total: number; page: number }> {
  const term = q.trim();
  const where = and(
    scopeOf(actor),
    bankId ? eq(referralCodes.bankId, bankId) : undefined,
    hideStopped ? eq(referralCodes.active, true) : undefined,
    term ? or(ilike(referralCodes.displayName, `%${term}%`), ilike(referralCodes.code, `%${term}%`)) : undefined,
  );
  const [{ total }] = await db.select({ total: count() }).from(referralCodes).where(where);
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const rows = await db
    .select({
      id: referralCodes.id,
      bankId: referralCodes.bankId,
      bankName: banks.name,
      displayName: referralCodes.displayName,
      code: referralCodes.code,
      qrKey: referralCodes.qrKey,
      openUrl: referralCodes.openUrl,
      priority: referralCodes.priority,
      monthlyQuota: referralCodes.monthlyQuota,
      active: referralCodes.active,
      // Tháng chưa có dòng riêng thì dùng số lượt mỗi tháng đang cài.
      quota: sql<number>`coalesce((select m.quota from referral_code_months m where m.referral_code_id = ${CODE_ID} and m.year_month = ${month}), "referral_codes"."monthly_quota")`,
      passed: countWhere(month, ["passed"]),
      holding: countWhere(month, ["selected", "pending"]),
      failed: countWhere(month, ["failed"]),
      createdByName: users.fullName,
    })
    .from(referralCodes)
    .innerJoin(banks, eq(banks.id, referralCodes.bankId))
    .leftJoin(users, eq(users.id, referralCodes.createdBy))
    .where(where)
    .orderBy(desc(referralCodes.active), asc(banks.sortOrder), desc(referralCodes.priority), asc(referralCodes.displayName))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);
  const links = rows.length ? await db.select().from(referralCodeSchools).where(inArray(referralCodeSchools.referralCodeId, rows.map((r) => r.id))) : [];
  const labels = new Map((await schoolLabels([...new Set(links.map((l) => l.schoolId))])).map((s) => [s.id, s]));
  return {
    total,
    page: safePage,
    rows: rows.map((r) => {
      const used = r.passed + r.holding + r.failed;
      // Lượt đang giữ và lượt không đạt đều chiếm chỗ của tháng.
      const status: CodeStatus = !r.active ? "stopped" : used >= r.quota ? "full" : "open";
      return { ...r, used, status, schools: links.filter((l) => l.referralCodeId === r.id).flatMap((l) => labels.get(l.schoolId) ?? []) };
    }),
  };
}

async function nameTaken(bankId: string, displayName: string, exceptId?: string) {
  const [row] = await db
    .select({ id: referralCodes.id })
    .from(referralCodes)
    .where(and(eq(referralCodes.bankId, bankId), eq(referralCodes.displayName, displayName), exceptId ? ne(referralCodes.id, exceptId) : undefined));
  return Boolean(row);
}

const record = (v: CodeFormValues) => ({ displayName: v.displayName, code: v.code, qrKey: v.qrKey, openUrl: v.openUrl, monthlyQuota: v.monthlyQuota, priority: v.priority });

export async function createCode(actor: SessionUser, values: CodeFormValues, ip?: string | null): Promise<{ ok: true; id: string } | Fail> {
  if (!canManageBank(actor, values.bankId)) return fail("Không tìm thấy ngân hàng.", 404, "bankId");
  if (await nameTaken(values.bankId, values.displayName)) return fail("Tên hiển thị đã có trong ngân hàng này.", 409, "displayName");
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(referralCodes).values({ ...record(values), bankId: values.bankId, createdBy: actor.id }).returning({ id: referralCodes.id });
    const schoolIds = [...new Set(values.schoolIds)];
    if (schoolIds.length) await tx.insert(referralCodeSchools).values(schoolIds.map((schoolId) => ({ referralCodeId: row.id, schoolId })));
    await writeAudit(tx, { userId: actor.id, action: "create_referral_code", targetType: "referral_codes", targetId: row.id, detail: values, ip });
    return row.id;
  });
  return { ok: true, id };
}

// Ngân hàng của mã không đổi khi sửa: lượt đã giữ chỗ gắn với ngân hàng cũ.
export async function updateCode(actor: SessionUser, id: string, values: CodeFormValues, ip?: string | null, month = currentYearMonth()): Promise<{ ok: true } | Fail> {
  const [before] = await db.select().from(referralCodes).where(eq(referralCodes.id, id));
  if (!before || !canManageBank(actor, before.bankId)) return fail("Không tìm thấy mã.", 404);
  if (await nameTaken(before.bankId, values.displayName, id)) return fail("Tên hiển thị đã có trong ngân hàng này.", 409, "displayName");
  await db.transaction(async (tx) => {
    await tx.update(referralCodes).set(record(values)).where(eq(referralCodes.id, id));
    // Sửa số lượt chỉ đổi tháng đang chạy; tháng đã qua giữ số đã chốt.
    if (values.monthlyQuota !== before.monthlyQuota) {
      await tx.update(referralCodeMonths).set({ quota: values.monthlyQuota }).where(and(eq(referralCodeMonths.referralCodeId, id), eq(referralCodeMonths.yearMonth, month)));
    }
    await tx.delete(referralCodeSchools).where(eq(referralCodeSchools.referralCodeId, id));
    const schoolIds = [...new Set(values.schoolIds)];
    if (schoolIds.length) await tx.insert(referralCodeSchools).values(schoolIds.map((schoolId) => ({ referralCodeId: id, schoolId })));
    await writeAudit(tx, { userId: actor.id, action: "update_referral_code", targetType: "referral_codes", targetId: id, detail: { before, after: values }, ip });
  });
  return { ok: true };
}

export async function setCodeActive(actor: SessionUser, id: string, active: boolean, ip?: string | null): Promise<{ ok: true } | Fail> {
  const [before] = await db.select({ bankId: referralCodes.bankId }).from(referralCodes).where(eq(referralCodes.id, id));
  if (!before || !canManageBank(actor, before.bankId)) return fail("Không tìm thấy mã.", 404);
  await db.update(referralCodes).set({ active }).where(eq(referralCodes.id, id));
  await writeAudit(db, { userId: actor.id, action: active ? "resume_referral_code" : "stop_referral_code", targetType: "referral_codes", targetId: id, ip });
  return { ok: true };
}
