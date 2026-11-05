import { randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "./db/client";
import { banks, customerBanks, customerExistingBanks, customers, referralCodeMonths, referralCodeSchools, referralCodes, schools } from "./db/schema";
import { hashToken } from "./auth/session";
import { publicSchool } from "./schools";
import { getSettings } from "./settings";
import { currentYearMonth, isYearMonth } from "@/lib/month";
import { plain } from "@/lib/text";
import type { CustomerFormValues } from "@/lib/customerForm";
import type { StudentState } from "@/lib/studentState";

export type Customer = typeof customers.$inferSelect;

type Fail = { ok: false; message: string; status: 400 | 404 | 409; field?: string };
const fail = (message: string, status: Fail["status"], field?: string): Fail => ({ ok: false, message, status, field });

type Executor = Pick<typeof db, "select">;

type Candidate = { id: string; bankId: string; bankName: string; bankSort: number; code: string | null; priority: number; createdAt: Date; quota: number; used: number };

// Mã ứng viên của trường: mã đang dùng của ngân hàng đang mở, gắn cho trường. Giữ chỗ thì khoá các dòng mã trước khi đếm lượt.
async function loadCandidates(ex: Executor, schoolId: string, month: string, lock = false): Promise<Candidate[]> {
  const query = ex
    .select({
      id: referralCodes.id,
      bankId: referralCodes.bankId,
      bankName: banks.name,
      bankSort: banks.sortOrder,
      code: referralCodes.code,
      priority: referralCodes.priority,
      monthlyQuota: referralCodes.monthlyQuota,
      createdAt: referralCodes.createdAt,
    })
    .from(referralCodes)
    .innerJoin(referralCodeSchools, and(eq(referralCodeSchools.referralCodeId, referralCodes.id), eq(referralCodeSchools.schoolId, schoolId)))
    .innerJoin(banks, eq(banks.id, referralCodes.bankId))
    .where(and(eq(referralCodes.active, true), eq(banks.active, true)))
    .orderBy(referralCodes.id);
  const codes = lock ? await query.for("update", { of: referralCodes }) : await query;
  if (!codes.length) return [];
  const ids = codes.map((c) => c.id);
  // Đếm ở câu riêng sau khi đã khoá: câu đếm chạy sau lượt chờ khoá mới thấy các dòng giữ chỗ vừa commit.
  const [months, used] = await Promise.all([
    ex.select({ id: referralCodeMonths.referralCodeId, quota: referralCodeMonths.quota }).from(referralCodeMonths).where(and(inArray(referralCodeMonths.referralCodeId, ids), eq(referralCodeMonths.yearMonth, month))),
    ex
      .select({ id: customerBanks.referralCodeId, n: count() })
      .from(customerBanks)
      .where(and(inArray(customerBanks.referralCodeId, ids), eq(customerBanks.yearMonth, month)))
      .groupBy(customerBanks.referralCodeId),
  ]);
  const quotaOf = new Map(months.map((m) => [m.id, m.quota]));
  const usedOf = new Map(used.map((u) => [u.id, u.n]));
  return codes.map(({ monthlyQuota, ...c }) => ({ ...c, quota: quotaOf.get(c.id) ?? monthlyQuota, used: usedOf.get(c.id) ?? 0 }));
}

function openBanksOf(candidates: Candidate[], exclude: Set<string>): { id: string; name: string }[] {
  const open = new Map<string, Candidate>();
  for (const c of candidates) if (c.used < c.quota && !exclude.has(c.bankId)) open.set(c.bankId, c);
  return [...open.values()].sort((a, b) => a.bankSort - b.bankSort || a.bankName.localeCompare(b.bankName, "vi")).map((c) => ({ id: c.bankId, name: c.bankName }));
}

export const openBanksAtSchool = async (schoolId: string, month = currentYearMonth()) => openBanksOf(await loadCandidates(db, schoolId, month), new Set());

// Học sinh không có tài khoản: token trên điện thoại là thứ duy nhất chứng minh hồ sơ là của mình.
export function newCustomerToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function bearerToken(request: Request): string | null {
  const m = /^Bearer\s+([A-Za-z0-9_-]{43})$/.exec(request.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

export async function customerFromRequest(request: Request): Promise<Customer | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const [row] = await db.select().from(customers).where(eq(customers.tokenHash, hashToken(token)));
  return row ?? null;
}

export async function touchCustomer(id: string): Promise<void> {
  await db.update(customers).set({ lastSeenAt: new Date() }).where(eq(customers.id, id));
}

export async function createCustomer(values: CustomerFormValues, ip: string | null, month = currentYearMonth()): Promise<{ ok: true; id: string; token: string } | Fail> {
  const school = await publicSchool(values.schoolId);
  if (!school) return fail("Không tìm thấy trường.", 404, "schoolId");
  if (!school.active) return fail("Trường đã đóng.", 409, "schoolId");
  const existing = [...new Set(values.existingBankIds)];
  if (existing.length && (await db.select({ id: banks.id }).from(banks).where(inArray(banks.id, existing))).length !== existing.length) {
    return fail("Ngân hàng không có trong danh sách.", 400, "existingBankIds");
  }
  const open = openBanksOf(await loadCandidates(db, school.id, month), new Set(existing));
  const { token, tokenHash } = newCustomerToken();
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(customers)
      .values({
        schoolId: school.id,
        fullName: values.fullName,
        nameSearch: plain(values.fullName),
        className: values.className,
        phone: values.phone,
        parentName: values.parentName,
        parentPhone: values.parentPhone,
        tokenHash,
        createdIp: ip && isIP(ip) ? ip : null,
        status: open.length ? "new" : "no_bank",
      })
      .returning({ id: customers.id });
    if (existing.length) await tx.insert(customerExistingBanks).values(existing.map((bankId) => ({ customerId: row.id, bankId })));
    return row.id;
  });
  return { ok: true, id, token };
}

async function existingBankIds(ex: Executor, customerId: string): Promise<Set<string>> {
  const rows = await ex.select({ id: customerExistingBanks.bankId }).from(customerExistingBanks).where(eq(customerExistingBanks.customerId, customerId));
  return new Set(rows.map((r) => r.id));
}

// Mã có priority cao nhất còn lượt; cùng priority thì mã tạo trước.
const pickCode = (candidates: Candidate[], bankId: string) =>
  candidates
    .filter((c) => c.bankId === bankId && c.used < c.quota)
    .sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))[0];

export async function reserveBanks(customer: Customer, bankIds: string[], month = currentYearMonth()): Promise<{ ok: true } | Fail> {
  if (!isYearMonth(month)) throw new Error(`Tháng giữ chỗ sai dạng: ${month}`);
  return db.transaction(async (tx) => {
    const [current] = await tx.select({ status: customers.status, schoolId: customers.schoolId }).from(customers).where(eq(customers.id, customer.id)).for("update");
    if (current?.status !== "new") return fail("Hồ sơ đã chọn ngân hàng.", 409);
    const candidates = await loadCandidates(tx, current.schoolId, month, true);
    const open = openBanksOf(candidates, await existingBankIds(tx, customer.id));
    if (!open.length) {
      await tx.update(customers).set({ status: "no_bank" }).where(eq(customers.id, customer.id));
      return fail("Không còn ngân hàng nào phù hợp.", 409);
    }
    const chosen = [...new Set(bankIds)];
    if (chosen.some((id) => !open.some((b) => b.id === id))) return fail("Ngân hàng vừa hết lượt. Chọn lại.", 409, "bankIds");
    const need = Math.min(2, open.length);
    if (chosen.length !== need || chosen.length !== bankIds.length) return fail(need === 2 ? "Chọn đúng 2 ngân hàng." : "Chọn 1 ngân hàng.", 400, "bankIds");
    for (const [i, bankId] of chosen.entries()) {
      const code = pickCode(candidates, bankId);
      await tx.insert(referralCodeMonths).values({ referralCodeId: code.id, yearMonth: month, quota: code.quota }).onConflictDoNothing();
      await tx.insert(customerBanks).values({ customerId: customer.id, bankId, slot: i + 1, referralCodeId: code.id, referralCode: code.code ?? "", yearMonth: month });
    }
    await tx.update(customers).set({ status: "banks_selected" }).where(eq(customers.id, customer.id));
    return { ok: true as const };
  });
}

export async function studentState(customer: Customer, month = currentYearMonth()): Promise<StudentState> {
  const [school] = await db.select({ id: schools.id, name: schools.name }).from(schools).where(eq(schools.id, customer.schoolId));
  const [existing, settings] = await Promise.all([existingBankIds(db, customer.id), getSettings()]);
  const existingBanks = existing.size ? (await db.select({ name: banks.name }).from(banks).where(inArray(banks.id, [...existing])).orderBy(asc(banks.sortOrder), asc(banks.name))).map((b) => b.name) : [];
  let status = customer.status;
  let eligibleBanks: StudentState["eligibleBanks"] = [];
  if (status === "new") {
    eligibleBanks = openBanksOf(await loadCandidates(db, customer.schoolId, month), existing);
    // Điểm dừng như lúc khai B1: hết ngân hàng thì hồ sơ ghi "Không có ngân hàng" cho hậu kiểm thấy.
    if (!eligibleBanks.length) {
      await db.update(customers).set({ status: "no_bank" }).where(and(eq(customers.id, customer.id), eq(customers.status, "new")));
      status = "no_bank";
    }
  }
  return {
    customer: { id: customer.id, fullName: customer.fullName, className: customer.className, status },
    school,
    eligibleBanks,
    existingBanks,
    zaloUrl: settings.zaloUrl,
    pviAppUrl: settings.pviAppUrl,
  };
}
