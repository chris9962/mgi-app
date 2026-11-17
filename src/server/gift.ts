import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "./db/client";
import { banks, customerBanks, customers, giftClaims, users } from "./db/schema";
import { writeAudit } from "./audit";
import { isUniqueViolation } from "./db/errors";
import type { Customer } from "./customers";
import { GIFT_MIN_BANKS, type GiftFormValues } from "@/lib/giftForm";
import { can } from "@/lib/permissions";
import type { StudentGift } from "@/lib/studentState";
import type { SessionUser } from "@/lib/types";

type Fail = { ok: false; message: string; status: 400 | 403 | 404 | 409; field?: string };
const fail = (message: string, status: Fail["status"], field?: string): Fail => ({ ok: false, message, status, field });

type Executor = Pick<typeof db, "select">;

// Ngân hàng đã gửi kiểm tra của hồ sơ: điều kiện nhận quà là từ 2 ngân hàng, và quà chuyển vào một trong số đó.
async function sentBanks(ex: Executor, customerId: string): Promise<{ id: string; name: string }[]> {
  return ex
    .select({ id: banks.id, name: banks.name })
    .from(customerBanks)
    .innerJoin(banks, eq(banks.id, customerBanks.bankId))
    .where(and(eq(customerBanks.customerId, customerId), ne(customerBanks.status, "selected")))
    .orderBy(customerBanks.slot);
}

const claimOf = (ex: Executor, customerId: string) =>
  ex
    .select({ bankName: banks.name, accountNumber: giftClaims.accountNumber, accountName: giftClaims.accountName, createdAt: giftClaims.createdAt, paidAt: giftClaims.paidAt, paidBy: users.fullName })
    .from(giftClaims)
    .innerJoin(banks, eq(banks.id, giftClaims.bankId))
    .leftJoin(users, eq(users.id, giftClaims.paidBy))
    .where(eq(giftClaims.customerId, customerId));

export async function giftState(customerId: string): Promise<StudentGift> {
  const [sent, [claim]] = await Promise.all([sentBanks(db, customerId), claimOf(db, customerId)]);
  return {
    eligible: sent.length >= GIFT_MIN_BANKS,
    banks: sent,
    claim: claim ? { bankName: claim.bankName, accountNumber: claim.accountNumber, accountName: claim.accountName, paidAt: claim.paidAt?.toISOString() ?? null } : null,
  };
}

export type GiftDetail = { bankName: string; accountNumber: string; accountName: string; createdAt: Date; paidAt: Date | null; paidBy: string | null } | null;

export async function giftDetail(customerId: string): Promise<{ eligible: boolean; claim: GiftDetail }> {
  const [sent, [claim]] = await Promise.all([sentBanks(db, customerId), claimOf(db, customerId)]);
  return { eligible: sent.length >= GIFT_MIN_BANKS, claim: claim ?? null };
}

export async function claimGift(customer: Customer, values: GiftFormValues): Promise<{ ok: true } | Fail> {
  return db
    .transaction(async (tx) => {
      await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customer.id)).for("update");
      const sent = await sentBanks(tx, customer.id);
      if (sent.length < GIFT_MIN_BANKS) return fail("Chưa đủ điều kiện nhận quà.", 409);
      if (!sent.some((b) => b.id === values.bankId)) return fail("Chọn ngân hàng đã gửi kiểm tra.", 400, "bankId");
      await tx.insert(giftClaims).values({ customerId: customer.id, bankId: values.bankId, accountNumber: values.accountNumber, accountName: values.accountName });
      return { ok: true as const };
    })
    .catch((e: unknown) => {
      if (isUniqueViolation(e, "gift_claims_customer_id_unique")) return fail("Đã nhập thông tin nhận quà.", 409);
      throw e;
    });
}

// Người có quyền Quản lý voucher đánh dấu đã chuyển quà, như trả thưởng voucher.
export async function markGiftPaid(actor: SessionUser, customerId: string, ip: string | null): Promise<{ ok: true } | Fail> {
  if (!can(actor, "vouchers")) return fail("Không có quyền đánh dấu chuyển quà.", 403);
  return db.transaction(async (tx) => {
    const [claim] = await tx.select({ id: giftClaims.id, paidAt: giftClaims.paidAt }).from(giftClaims).where(eq(giftClaims.customerId, customerId)).for("update");
    if (!claim) return fail("Học sinh chưa nhập tài khoản nhận quà.", 404);
    if (claim.paidAt) return fail("Đã đánh dấu chuyển quà.", 409);
    await tx.update(giftClaims).set({ paidAt: new Date(), paidBy: actor.id }).where(and(eq(giftClaims.id, claim.id), isNull(giftClaims.paidAt)));
    await writeAudit(tx, { userId: actor.id, action: "pay_gift", targetType: "customers", targetId: customerId, ip });
    return { ok: true as const };
  });
}
