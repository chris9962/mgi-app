import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db/client";
import { banks, customerBanks, customerExistingBanks, customers, proofPhotos, reviewEvents, schools, smsMessages, vouchers } from "./db/schema";
import { writeAudit } from "./audit";
import { removeQuietly, s3PhotoStore, type PhotoStore } from "./customerPhotos";
import { syncCustomerStatus } from "./customerStatus";
import type { Tx } from "./photoChecks";
import { can } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

type Fail = { ok: false; message: string; status: 403 | 404 };
const fail = (message: string, status: Fail["status"]): Fail => ({ ok: false, message, status });
const FORBIDDEN = fail("Không có quyền xoá.", 403);
const BANK_NOT_FOUND = fail("Không tìm thấy ngân hàng của hồ sơ.", 404);

type Store = Pick<PhotoStore, "remove">;

// Đọc khoá ảnh trước khi xoá dòng ngân hàng: cascade xoá dòng ảnh, kể cả ảnh đã bị thay.
async function photoKeys(tx: Tx, rowIds: string[]): Promise<string[]> {
  if (!rowIds.length) return [];
  return (await tx.select({ key: proofPhotos.s3Key }).from(proofPhotos).where(inArray(proofPhotos.customerBankId, rowIds))).map((r) => r.key);
}

export async function deleteCustomer(actor: SessionUser, id: string, ip: string | null, store: Store = s3PhotoStore): Promise<{ ok: true } | Fail> {
  if (!can(actor, "delete_customers")) return FORBIDDEN;
  const r = await db.transaction(async (tx) => {
    const [c] = await tx
      .select({ fullName: customers.fullName, className: customers.className, parentPhone: customers.parentPhone, schoolName: schools.name })
      .from(customers)
      .innerJoin(schools, eq(schools.id, customers.schoolId))
      .where(eq(customers.id, id))
      .for("update", { of: customers });
    if (!c) return fail("Không tìm thấy hồ sơ.", 404);
    const rows = await tx
      .select({ id: customerBanks.id, bank: banks.name, status: customerBanks.status })
      .from(customerBanks)
      .innerJoin(banks, eq(banks.id, customerBanks.bankId))
      .where(eq(customerBanks.customerId, id));
    const ids = rows.map((row) => row.id);
    const keys = await photoKeys(tx, ids);
    const [voucher] = await tx.select({ code: vouchers.code }).from(vouchers).where(eq(vouchers.customerId, id));
    if (ids.length) await tx.delete(reviewEvents).where(inArray(reviewEvents.customerBankId, ids));
    await tx.delete(customerBanks).where(eq(customerBanks.customerId, id));
    await tx.delete(customerExistingBanks).where(eq(customerExistingBanks.customerId, id));
    await tx.delete(smsMessages).where(eq(smsMessages.customerId, id));
    await tx.delete(vouchers).where(eq(vouchers.customerId, id));
    await tx.delete(customers).where(eq(customers.id, id));
    const detail = { ...c, banks: rows.map(({ bank, status }) => ({ bank, status })), voucher: voucher?.code ?? null };
    await writeAudit(tx, { userId: actor.id, action: "delete_customer", targetType: "customers", targetId: id, detail, ip });
    return { ok: true as const, keys };
  });
  if (!r.ok) return r;
  await removeQuietly(store, r.keys);
  return { ok: true };
}

export async function deleteCustomerBank(actor: SessionUser, customerBankId: string, ip: string | null, store: Store = s3PhotoStore): Promise<{ ok: true; customerId: string } | Fail> {
  if (!can(actor, "delete_customers")) return FORBIDDEN;
  const [target] = await db.select({ customerId: customerBanks.customerId }).from(customerBanks).where(eq(customerBanks.id, customerBankId));
  if (!target) return BANK_NOT_FOUND;
  const r = await db.transaction(async (tx) => {
    // Khoá hồ sơ như lúc hậu kiểm và học sinh gửi kiểm tra: thao tác cùng hồ sơ chờ nhau.
    await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, target.customerId)).for("update");
    const [row] = await tx
      .select({ bank: banks.name, slot: customerBanks.slot, status: customerBanks.status, referralCode: customerBanks.referralCode })
      .from(customerBanks)
      .innerJoin(banks, eq(banks.id, customerBanks.bankId))
      .where(and(eq(customerBanks.id, customerBankId), eq(customerBanks.customerId, target.customerId)));
    if (!row) return BANK_NOT_FOUND;
    const keys = await photoKeys(tx, [customerBankId]);
    await tx.delete(reviewEvents).where(eq(reviewEvents.customerBankId, customerBankId));
    await tx.delete(customerBanks).where(eq(customerBanks.id, customerBankId));
    await syncCustomerStatus(tx, target.customerId);
    await writeAudit(tx, { userId: actor.id, action: "delete_customer_bank", targetType: "customer_banks", targetId: customerBankId, detail: { customerId: target.customerId, ...row }, ip });
    return { ok: true as const, keys };
  });
  if (!r.ok) return r;
  await removeQuietly(store, r.keys);
  return { ok: true, customerId: target.customerId };
}
