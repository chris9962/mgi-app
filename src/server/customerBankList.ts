import { and, asc, count, desc, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { db } from "./db/client";
import { banks, customerBanks, customers, schools, users } from "./db/schema";
import { customerSearch, latestCheck, scopedBankIds } from "./customerList";
import { schoolLabels } from "./schools";
import { dayRange } from "@/lib/urlParams";
import { parseCustomerBankFilters, type CustomerBankFilters } from "@/lib/customerBankFilters";
import type { Params } from "@/lib/urlParams";
import type { CustomerBankStatus } from "@/lib/studentState";
import type { SessionUser } from "@/lib/types";

export const PAGE_SIZE = 15;

export type BankCheck = { status: "pending" | "done" | "failed"; passed: number; total: number };
export type CustomerBankRow = {
  id: string;
  customerId: string;
  slot: number;
  bankId: string;
  bankName: string;
  status: CustomerBankStatus;
  referralCode: string;
  fullName: string;
  className: string;
  schoolName: string;
  parentPhone: string;
  createdAt: Date;
  reviewer: string | null;
  reviewedAt: Date | null;
  check: BankCheck | null;
};

// Câu con ghi rõ "customer_banks"."id": Drizzle in cột trần, "id" trong câu con sẽ trỏ nhầm sang bảng con.
const CUSTOMER_BANK_ID = sql.raw(`"customer_banks"."id"`);

// Phạm vi dòng dùng cùng customerScope với reviewsBank: dòng nào người xem thấy thì người đó quản ngân hàng của dòng, nên x/y hiện ở mọi dòng.
export function customerBankWhere(actor: SessionUser, f: CustomerBankFilters): SQL | undefined {
  const scope = scopedBankIds(actor);
  const { start, end } = dayRange(f.from, f.to);
  return and(
    scope ? (scope.length ? inArray(customerBanks.bankId, scope) : sql`false`) : undefined,
    f.bank.length ? inArray(customerBanks.bankId, f.bank) : undefined,
    f.status ? eq(customerBanks.status, f.status) : undefined,
    f.school.length ? inArray(customers.schoolId, f.school) : undefined,
    start ? gte(customers.createdAt, start) : undefined,
    end ? lt(customers.createdAt, end) : undefined,
    f.check
      ? sql`exists (select 1 from ${latestCheck(CUSTOMER_BANK_ID)} lc where lc.status = 'done' and ${f.check === "full" ? sql`lc.total > 0 and lc.passed = lc.total` : sql`lc.passed < lc.total`})`
      : undefined,
    customerSearch(f.q),
  );
}

export const customerBankOrder = (dir: CustomerBankFilters["dir"]) => {
  const by = dir === "asc" ? asc : desc;
  return [by(customers.createdAt), by(customers.id), asc(customerBanks.slot)];
};

const rowColumns = {
  id: customerBanks.id,
  customerId: customerBanks.customerId,
  slot: customerBanks.slot,
  bankId: customerBanks.bankId,
  bankName: banks.name,
  status: customerBanks.status,
  referralCode: customerBanks.referralCode,
  fullName: customers.fullName,
  className: customers.className,
  schoolName: schools.name,
  parentPhone: customers.parentPhone,
  createdAt: customers.createdAt,
  reviewer: users.fullName,
  reviewedAt: customerBanks.reviewedAt,
  check: sql<BankCheck | null>`(select json_build_object('status', lc.status, 'passed', lc.passed, 'total', lc.total) from ${latestCheck(CUSTOMER_BANK_ID)} lc)`,
};

const base = () =>
  db
    .select(rowColumns)
    .from(customerBanks)
    .innerJoin(customers, eq(customers.id, customerBanks.customerId))
    .innerJoin(banks, eq(banks.id, customerBanks.bankId))
    .innerJoin(schools, eq(schools.id, customers.schoolId))
    .leftJoin(users, eq(users.id, customerBanks.reviewedBy));

export async function countCustomerBanks(actor: SessionUser, f: CustomerBankFilters): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(customerBanks).innerJoin(customers, eq(customers.id, customerBanks.customerId)).where(customerBankWhere(actor, f));
  return total;
}

export const allCustomerBanks = (actor: SessionUser, f: CustomerBankFilters): Promise<CustomerBankRow[]> => base().where(customerBankWhere(actor, f)).orderBy(...customerBankOrder(f.dir));

export async function listCustomerBanks(actor: SessionUser, f: CustomerBankFilters, page: number): Promise<{ rows: CustomerBankRow[]; total: number; page: number }> {
  const where = customerBankWhere(actor, f);
  const total = await countCustomerBanks(actor, f);
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const rows = await base()
    .where(where)
    .orderBy(...customerBankOrder(f.dir))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);
  return { total, page: safePage, rows };
}

// Ô lọc ngân hàng chỉ liệt kê ngân hàng người xem thấy dòng; readCustomerBankFilters bỏ id ngoài danh sách này.
export async function scopedBanks(actor: SessionUser): Promise<{ id: string; name: string }[]> {
  const scope = scopedBankIds(actor);
  if (scope && !scope.length) return [];
  return db
    .select({ id: banks.id, name: banks.name })
    .from(banks)
    .where(scope ? inArray(banks.id, scope) : undefined)
    .orderBy(sql`${banks.active} desc`, asc(banks.sortOrder), asc(banks.name));
}

// Id ngân hàng ngoài phạm vi hoặc trường không còn thì bỏ ngay lúc đọc URL: chip, số trên nút Bộ lọc và bảng cùng đọc một bộ lọc, không kẹt ở bảng rỗng không có chip để bỏ.
export async function readCustomerBankFilters(actor: SessionUser, sp: Params) {
  const parsed = parseCustomerBankFilters(sp);
  const [banks, schools] = await Promise.all([scopedBanks(actor), schoolLabels(parsed.school)]);
  const filters: CustomerBankFilters = {
    ...parsed,
    bank: parsed.bank.filter((id) => banks.some((b) => b.id === id)),
    school: parsed.school.filter((id) => schools.some((s) => s.id === id)),
  };
  return { filters, banks, schools };
}
