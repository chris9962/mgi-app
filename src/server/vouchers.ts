import { and, count, desc, eq, gte, like, lt, or, type SQL } from "drizzle-orm";
import { db } from "./db/client";
import { customers, schools, vouchers } from "./db/schema";
import { containsPattern } from "./search";
import { can } from "@/lib/permissions";
import { plain } from "@/lib/text";
import { dayRange } from "@/lib/urlParams";
import type { VoucherFilters } from "@/lib/voucherFilters";
import type { SessionUser } from "@/lib/types";

export const PAGE_SIZE = 15;

export type VoucherRow = { id: string; code: string; customerId: string; fullName: string; className: string; schoolName: string; parentName: string; parentPhone: string; issuedAt: Date };

export function voucherWhere(f: VoucherFilters): SQL | undefined {
  const { start, end } = dayRange(f.from, f.to);
  return and(
    f.q ? or(like(vouchers.code, containsPattern(f.q.toUpperCase())), like(customers.nameSearch, containsPattern(plain(f.q).replace(/\s+/g, " ")))) : undefined,
    start ? gte(vouchers.issuedAt, start) : undefined,
    end ? lt(vouchers.issuedAt, end) : undefined,
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
  parentPhone: customers.parentPhone,
  issuedAt: vouchers.issuedAt,
};

export const voucherBase = () => db.select(voucherColumns).from(vouchers).innerJoin(customers, eq(customers.id, vouchers.customerId)).innerJoin(schools, eq(schools.id, customers.schoolId));

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
