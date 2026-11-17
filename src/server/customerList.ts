import { and, asc, count, desc, eq, gte, inArray, like, lt, sql, type SQL } from "drizzle-orm";
import { db } from "./db/client";
import { banks, customerBanks, customers, schools, users } from "./db/schema";
import { containsPattern, likeEachTerm, phoneDigits } from "./search";
import { customerScope, reviewsBank } from "@/lib/permissions";
import { dayRange, type CustomerFilters } from "@/lib/customerFilters";
import type { CustomerBankStatus, CustomerStatus } from "@/lib/studentState";
import type { SessionUser } from "@/lib/types";

export const PAGE_SIZE = 15;

export type PhotoCheckCount = { passed: number; total: number };
export type ListBank = { id: string; slot: number; bankId: string; name: string; status: CustomerBankStatus; managed: boolean; check: PhotoCheckCount | null };
export type CustomerListRow = {
  id: string;
  fullName: string;
  className: string;
  schoolName: string;
  parentPhone: string;
  status: CustomerStatus;
  submittedAt: Date | null;
  createdAt: Date;
  banks: ListBank[];
  reviewers: string[];
};

// Câu con ghi rõ "customers"."id": Drizzle in cột trần, "id" trong câu con sẽ trỏ nhầm sang bảng con.
const CUSTOMER_ID = sql.raw(`"customers"."id"`);
const CUSTOMER_BANK_ID = sql.raw(`"customer_banks"."id"`);

const inBanks = (ids: string[] | null): SQL =>
  ids === null
    ? sql`true`
    : ids.length
      ? sql`cb.bank_id in (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql`false`;

export const scopedBankIds = (actor: SessionUser): string[] | null => {
  const scope = customerScope(actor);
  return scope.all ? null : scope.bankIds;
};

// Lượt kiểm mới nhất của mỗi dòng ngân hàng; lượt cũ hơn không còn đúng với ảnh đang dùng.
export const latestCheck = (cbId: SQL) => sql`(select pc.status, pc.passed, pc.total from photo_checks pc where pc.customer_bank_id = ${cbId} order by pc.created_at desc limit 1)`;

export function customerSearch(q: string): SQL | undefined {
  if (!q) return undefined;
  const digits = phoneDigits(q);
  return digits ? like(customers.parentPhone, containsPattern(digits)) : likeEachTerm(customers.nameSearch, q);
}

export function customerWhere(actor: SessionUser, f: CustomerFilters): SQL | undefined {
  const ids = scopedBankIds(actor);
  const { start, end } = dayRange(f.from, f.to);
  return and(
    ids ? sql`exists (select 1 from ${customerBanks} cb where cb.customer_id = ${CUSTOMER_ID} and ${inBanks(ids)})` : undefined,
    f.status ? eq(customers.status, f.status) : undefined,
    start ? gte(customers.createdAt, start) : undefined,
    end ? lt(customers.createdAt, end) : undefined,
    // Mốc 3 là "từ 3 trở lên": học sinh chọn được nhiều ngân hàng, không liệt kê từng số.
    f.passed ? sql`(select count(*) from ${customerBanks} cb where cb.customer_id = ${CUSTOMER_ID} and cb.status = 'passed') ${f.passed === "3" ? sql`>=` : sql`=`} ${Number(f.passed)}` : undefined,
    f.check
      ? sql`exists (select 1 from ${customerBanks} cb cross join lateral ${latestCheck(sql`cb.id`)} pc
          where cb.customer_id = ${CUSTOMER_ID} and ${inBanks(ids)} and pc.status = 'done'
          and ${f.check === "full" ? sql`pc.total > 0 and pc.passed = pc.total` : sql`pc.passed < pc.total`})`
      : undefined,
    customerSearch(f.q),
  );
}

export const customerOrder = [desc(customers.createdAt), desc(customers.id)];

const rowColumns = {
  id: customers.id,
  fullName: customers.fullName,
  className: customers.className,
  schoolName: schools.name,
  parentPhone: customers.parentPhone,
  status: customers.status,
  submittedAt: customers.submittedAt,
  createdAt: customers.createdAt,
};

export async function banksOf(actor: SessionUser, customerIds: string[]) {
  if (!customerIds.length) return [];
  const rows = await db
    .select({
      customerId: customerBanks.customerId,
      id: customerBanks.id,
      slot: customerBanks.slot,
      bankId: customerBanks.bankId,
      name: banks.name,
      status: customerBanks.status,
      referralCode: customerBanks.referralCode,
      reviewedAt: customerBanks.reviewedAt,
      reviewer: users.fullName,
      check: sql<PhotoCheckCount | null>`(select case when lc.status = 'done' then json_build_object('passed', lc.passed, 'total', lc.total) end from ${latestCheck(CUSTOMER_BANK_ID)} lc)`,
    })
    .from(customerBanks)
    .innerJoin(banks, eq(banks.id, customerBanks.bankId))
    .leftJoin(users, eq(users.id, customerBanks.reviewedBy))
    .where(inArray(customerBanks.customerId, customerIds))
    .orderBy(asc(customerBanks.slot));
  return rows.map((r) => {
    const managed = reviewsBank(actor, r.bankId);
    return { ...r, managed, check: managed ? r.check : null };
  });
}

export async function listCustomers(actor: SessionUser, f: CustomerFilters, page: number): Promise<{ rows: CustomerListRow[]; total: number; page: number }> {
  const where = customerWhere(actor, f);
  const [{ total }] = await db.select({ total: count() }).from(customers).where(where);
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const rows = await db
    .select(rowColumns)
    .from(customers)
    .innerJoin(schools, eq(schools.id, customers.schoolId))
    .where(where)
    .orderBy(...customerOrder)
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);
  const bankRows = await banksOf(
    actor,
    rows.map((r) => r.id),
  );
  return {
    total,
    page: safePage,
    rows: rows.map((r) => {
      const mine = bankRows.filter((b) => b.customerId === r.id);
      return {
        ...r,
        banks: mine.map(({ id, slot, bankId, name, status, managed, check }) => ({ id, slot, bankId, name, status, managed, check })),
        reviewers: [...new Set(mine.flatMap((b) => (b.reviewer ? [b.reviewer] : [])))],
      };
    }),
  };
}
