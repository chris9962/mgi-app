import { and, asc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "./db/client";
import { bankPhotoSlots, banks, customerBanks, referralCodeMonths, referralCodes, userManagedBanks, users } from "./db/schema";
import { writeAudit } from "./audit";
import { isUniqueViolation } from "./db/errors";
import { matchesEachTerm } from "./search";
import { can, canManageBank } from "@/lib/permissions";
import { currentYearMonth } from "@/lib/month";
import type { SessionUser } from "@/lib/types";
import type { BankFormValues, GuideFormValues } from "@/lib/bankForm";

export type BankRow = {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
  slotCount: number;
  openCodeCount: number;
  managers: { id: string; fullName: string }[];
};

export type GuideSlotRow = { id: string; name: string; sampleKey: string | null; checkName: boolean; checkCode: boolean };

type Fail = { ok: false; message: string; field?: string; status: 400 | 403 | 404 | 409 };
const fail = (message: string, status: Fail["status"], field?: string): Fail => ({ ok: false, message, status, field });
const CODE_TAKEN = fail("Mã ngân hàng đã có.", 409, "code");
const GUIDE_CHANGED = fail("Hướng dẫn đã có người sửa. Mở lại để xem bản mới.", 409);
const codeRace = (e: unknown): Fail => {
  if (isUniqueViolation(e, "banks_code_unique")) return CODE_TAKEN;
  throw e;
};

// Câu đếm con ghi rõ "banks"."id": Drizzle in cột của truy vấn một bảng không kèm tên bảng, và "id" trong câu con sẽ trỏ nhầm sang bảng con.
const BANK_ID = sql.raw(`"banks"."id"`);

// Mã còn chỗ của tháng đang chạy: số lượt của tháng (dòng tháng hoặc monthly_quota) lớn hơn số lượt đã giữ chỗ trong tháng.
const openCodes = (month: string) => sql<number>`(
  select count(*)::int from ${referralCodes} rc
  where rc.bank_id = ${BANK_ID} and rc.active
    and coalesce((select m.quota from ${referralCodeMonths} m where m.referral_code_id = rc.id and m.year_month = ${month}), rc.monthly_quota)
      > (select count(*) from ${customerBanks} cb where cb.referral_code_id = rc.id and cb.year_month = ${month})
)`;

export async function listBanks(actor: SessionUser): Promise<BankRow[]> {
  const scope = can(actor, "manage_banks") ? undefined : inArray(banks.id, actor.managedBankIds.length ? actor.managedBankIds : ["00000000-0000-0000-0000-000000000000"]);
  const rows = await db
    .select({
      id: banks.id,
      code: banks.code,
      name: banks.name,
      sortOrder: banks.sortOrder,
      active: banks.active,
      slotCount: sql<number>`(select count(*)::int from ${bankPhotoSlots} s where s.bank_id = ${BANK_ID} and s.removed_at is null)`,
      openCodeCount: openCodes(currentYearMonth()),
    })
    .from(banks)
    .where(scope)
    .orderBy(sql`${banks.active} desc`, asc(banks.sortOrder), asc(banks.name));
  const managers = rows.length
    ? await db
        .select({ bankId: userManagedBanks.bankId, id: users.id, fullName: users.fullName })
        .from(userManagedBanks)
        .innerJoin(users, eq(users.id, userManagedBanks.userId))
        .where(inArray(userManagedBanks.bankId, rows.map((r) => r.id)))
        .orderBy(asc(users.fullName))
    : [];
  return rows.map((r) => ({ ...r, managers: managers.filter((m) => m.bankId === r.id).map(({ id, fullName }) => ({ id, fullName })) }));
}

async function codeTaken(code: string, exceptId?: string) {
  const [row] = await db.select({ id: banks.id }).from(banks).where(and(eq(banks.code, code), exceptId ? ne(banks.id, exceptId) : undefined));
  return Boolean(row);
}

// Người quản chỉ là Nhân viên: Quản trị và Quản lý đã quản mọi ngân hàng.
async function validManagers(ids: string[]): Promise<boolean> {
  if (!ids.length) return true;
  const rows = await db.select({ id: users.id }).from(users).where(and(inArray(users.id, ids), eq(users.role, "staff"), eq(users.active, true)));
  return rows.length === new Set(ids).size;
}

export async function createBank(actor: SessionUser, values: BankFormValues, ip?: string | null): Promise<{ ok: true; id: string } | Fail> {
  if (!can(actor, "manage_banks")) return fail("Không có quyền tạo ngân hàng.", 403);
  if (await codeTaken(values.code)) return CODE_TAKEN;
  if (!(await validManagers(values.managerIds))) return fail("Người quản phải là Nhân viên đang hoạt động.", 400, "managerIds");
  return db
    .transaction(async (tx) => {
      const [row] = await tx.insert(banks).values({ code: values.code, name: values.name, sortOrder: values.sortOrder }).returning({ id: banks.id });
      if (values.managerIds.length) await tx.insert(userManagedBanks).values([...new Set(values.managerIds)].map((userId) => ({ userId, bankId: row.id })));
      await writeAudit(tx, { userId: actor.id, action: "create_bank", targetType: "banks", targetId: row.id, detail: values, ip });
      return { ok: true as const, id: row.id };
    })
    .catch(codeRace);
}

export async function updateBank(actor: SessionUser, id: string, values: BankFormValues, ip?: string | null): Promise<{ ok: true } | Fail> {
  if (!canManageBank(actor, id)) return fail("Không tìm thấy ngân hàng.", 404);
  const [before] = await db.select().from(banks).where(eq(banks.id, id));
  if (!before) return fail("Không tìm thấy ngân hàng.", 404);
  if (await codeTaken(values.code, id)) return CODE_TAKEN;
  // Giao người quản là việc của quyền Quản lý ngân hàng; người được giao sửa ngân hàng mình thì danh sách người quản giữ nguyên.
  const assign = can(actor, "manage_banks");
  // Người quản đã giao rồi mới bị khoá vẫn được giữ, không thì sửa tên ngân hàng cũng bị chặn: chỉ người mới thêm phải là Nhân viên đang hoạt động.
  const assigned = new Set((await db.select({ userId: userManagedBanks.userId }).from(userManagedBanks).where(eq(userManagedBanks.bankId, id))).map((r) => r.userId));
  if (assign && !(await validManagers(values.managerIds.filter((m) => !assigned.has(m))))) return fail("Người quản phải là Nhân viên đang hoạt động.", 400, "managerIds");
  return db
    .transaction(async (tx) => {
      await tx.update(banks).set({ code: values.code, name: values.name, sortOrder: values.sortOrder }).where(eq(banks.id, id));
      if (assign) {
        await tx.delete(userManagedBanks).where(eq(userManagedBanks.bankId, id));
        if (values.managerIds.length) await tx.insert(userManagedBanks).values([...new Set(values.managerIds)].map((userId) => ({ userId, bankId: id })));
      }
      await writeAudit(tx, { userId: actor.id, action: "update_bank", targetType: "banks", targetId: id, detail: { before, after: assign ? values : { ...values, managerIds: undefined } }, ip });
      return { ok: true as const };
    })
    .catch(codeRace);
}

export async function setBankActive(actor: SessionUser, id: string, active: boolean, ip?: string | null): Promise<{ ok: true } | Fail> {
  if (!canManageBank(actor, id)) return fail("Không tìm thấy ngân hàng.", 404);
  const [row] = await db.update(banks).set({ active }).where(eq(banks.id, id)).returning({ id: banks.id });
  if (!row) return fail("Không tìm thấy ngân hàng.", 404);
  await writeAudit(db, { userId: actor.id, action: active ? "open_bank" : "close_bank", targetType: "banks", targetId: id, ip });
  return { ok: true };
}

export async function getGuide(bankId: string): Promise<{ steps: string[]; slots: GuideSlotRow[] } | null> {
  const [bank] = await db.select({ guide: banks.guide }).from(banks).where(eq(banks.id, bankId));
  if (!bank) return null;
  const slots = await db
    .select({ id: bankPhotoSlots.id, name: bankPhotoSlots.name, sampleKey: bankPhotoSlots.sampleKey, checkName: bankPhotoSlots.checkName, checkCode: bankPhotoSlots.checkCode })
    .from(bankPhotoSlots)
    .where(and(eq(bankPhotoSlots.bankId, bankId), isNull(bankPhotoSlots.removedAt)))
    .orderBy(asc(bankPhotoSlots.sortOrder), asc(bankPhotoSlots.name));
  return { steps: Array.isArray(bank.guide) ? (bank.guide as string[]) : [], slots };
}

export async function saveGuide(actor: SessionUser, bankId: string, values: GuideFormValues, ip?: string | null): Promise<{ ok: true } | Fail> {
  if (!canManageBank(actor, bankId)) return fail("Không tìm thấy ngân hàng.", 404);
  const current = await getGuide(bankId);
  if (!current) return fail("Không tìm thấy ngân hàng.", 404);
  const currentIds = new Set(current.slots.map((s) => s.id));
  // Bản cũ ở tab khác không còn khung vừa thêm: lưu đè thì khung đó bị bỏ mà không ai biết.
  const seen = new Set(values.seenSlotIds);
  if (seen.size !== currentIds.size || [...currentIds].some((id) => !seen.has(id))) return GUIDE_CHANGED;
  if (values.slots.some((s) => s.id && !currentIds.has(s.id))) return fail("Khung ảnh không thuộc ngân hàng này.", 400, "slots");
  await db.transaction(async (tx) => {
    await tx.update(banks).set({ guide: values.steps }).where(eq(banks.id, bankId));
    const kept = new Set(values.slots.flatMap((s) => (s.id ? [s.id] : [])));
    // Bỏ khung thì đánh dấu removed_at: ảnh học sinh đã nộp vào khung đó vẫn giữ tên khung.
    const removed = current.slots.filter((s) => !kept.has(s.id)).map((s) => s.id);
    if (removed.length) await tx.update(bankPhotoSlots).set({ removedAt: new Date() }).where(inArray(bankPhotoSlots.id, removed));
    for (const [sortOrder, s] of values.slots.entries()) {
      const fields = { name: s.name, sampleKey: s.sampleKey, checkName: s.checkName, checkCode: s.checkCode, sortOrder };
      if (s.id) await tx.update(bankPhotoSlots).set(fields).where(eq(bankPhotoSlots.id, s.id));
      else await tx.insert(bankPhotoSlots).values({ ...fields, bankId });
    }
    await writeAudit(tx, { userId: actor.id, action: "save_bank_guide", targetType: "banks", targetId: bankId, detail: { before: current, after: values }, ip });
  });
  return { ok: true };
}

export async function managerOptions(q: string): Promise<{ id: string; label: string }[]> {
  const rows = await db
    .select({ id: users.id, fullName: users.fullName, title: users.title })
    .from(users)
    .where(and(eq(users.role, "staff"), eq(users.active, true), matchesEachTerm([users.fullName, users.username], q)))
    .orderBy(asc(users.fullName))
    .limit(20);
  return rows.map((r) => ({ id: r.id, label: r.title ? `${r.fullName} - ${r.title}` : r.fullName }));
}
