import { and, asc, count, desc, eq, gte, inArray, like, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "./db/client";
import { banks, customerBanks, customers, schools, smsMessages, vouchers } from "./db/schema";
import { schoolLabels } from "./schools";
import { containsPattern, searchTerms } from "./search";
import { can } from "@/lib/permissions";
import { dayRange } from "@/lib/urlParams";
import { SMS_KIND_VOUCHER } from "@/lib/sms";
import type { SmsStatus } from "@/lib/smsFilters";
import type { Params } from "@/lib/urlParams";
import { parseVoucherFilters, type VoucherFilters } from "@/lib/voucherFilters";
import type { SessionUser } from "@/lib/types";

export const PAGE_SIZE = 15;

export type VoucherRow = { id: string; code: string; customerId: string; fullName: string; className: string; schoolName: string; parentName: string; issuedAt: Date; smsStatus: SmsStatus | null };

// Câu con ghi rõ "vouchers"."customer_id": Drizzle in cột trần, "customer_id" trong câu con sẽ trỏ nhầm sang bảng con.
const VOUCHER_CUSTOMER = sql.raw(`"vouchers"."customer_id"`);

export function voucherWhere(f: VoucherFilters): SQL | undefined {
  const { start, end } = dayRange(f.from, f.to);
  return and(
    // Như ô tìm tài khoản của mgst-app: mỗi từ khớp mã hoặc họ tên, "bpt07 phan trang" ra mã BPT07 của Biên Phân Trang.
    and(
      ...searchTerms(f.q).map((t) =>
        or(like(vouchers.code, containsPattern(t.toUpperCase())), like(customers.nameSearch, containsPattern(t)), /^\d+$/.test(t) ? like(customers.parentPhone, containsPattern(t)) : undefined),
      ),
    ),
    start ? gte(vouchers.issuedAt, start) : undefined,
    end ? lt(vouchers.issuedAt, end) : undefined,
    f.school.length ? inArray(customers.schoolId, f.school) : undefined,
    f.bank.length
      ? sql`exists (select 1 from ${customerBanks} cb where cb.customer_id = ${VOUCHER_CUSTOMER} and cb.status = 'passed' and cb.bank_id in (${sql.join(
          f.bank.map((id) => sql`${id}`),
          sql`, `,
        )}))`
      : undefined,
    f.sms ? sql`exists (select 1 from ${smsMessages} m where m.customer_id = ${VOUCHER_CUSTOMER} and m.kind = ${SMS_KIND_VOUCHER} and m.status = ${f.sms})` : undefined,
  );
}

export const voucherColumns = {
  id: vouchers.id,
  code: vouchers.code,
  customerId: vouchers.customerId,
  fullName: customers.fullName,
  className: customers.className,
  schoolName: schools.name,
  parentName: customers.parentName,
  issuedAt: vouchers.issuedAt,
  smsStatus: smsMessages.status,
};

export const voucherBase = () => db.select(voucherColumns).from(vouchers).innerJoin(customers, eq(customers.id, vouchers.customerId)).innerJoin(schools, eq(schools.id, customers.schoolId)).leftJoin(smsMessages, and(eq(smsMessages.customerId, vouchers.customerId), eq(smsMessages.kind, SMS_KIND_VOUCHER)));

// Quyền Quản lý voucher xem mọi mã đã cấp, không giới hạn theo ngân hàng.
export async function listVouchers(actor: SessionUser, f: VoucherFilters, page: number): Promise<{ rows: VoucherRow[]; total: number; page: number }> {
  if (!can(actor, "vouchers")) return { rows: [], total: 0, page: 1 };
  const where = voucherWhere(f);
  const [{ total }] = await db.select({ total: count() }).from(vouchers).innerJoin(customers, eq(customers.id, vouchers.customerId)).where(where);
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const rows = await voucherBase()
    .where(where)
    .orderBy(desc(vouchers.issuedAt), desc(vouchers.id))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);
  return { rows, total, page: safePage };
}

// Id trên URL không còn trong DB thì bỏ khỏi bộ lọc, chip và ô chọn không hiện id trần.
export async function readVoucherFilters(sp: Params) {
  const parsed = parseVoucherFilters(sp);
  const [bankOptions, schoolOptions] = await Promise.all([
    db.select({ id: banks.id, name: banks.name }).from(banks).orderBy(sql`${banks.active} desc`, asc(banks.sortOrder), asc(banks.name)),
    schoolLabels(parsed.school),
  ]);
  const filters: VoucherFilters = { ...parsed, bank: parsed.bank.filter((id) => bankOptions.some((b) => b.id === id)), school: parsed.school.filter((id) => schoolOptions.some((s) => s.id === id)) };
  return { filters, banks: bankOptions, schools: schoolOptions };
}
