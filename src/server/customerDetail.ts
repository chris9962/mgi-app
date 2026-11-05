import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "./db/client";
import { bankPhotoSlots, banks, customerBanks, customerExistingBanks, customers, photoChecks, proofPhotos, schools, smsMessages, userManagedBanks, users, vouchers } from "./db/schema";
import { writeAudit } from "./audit";
import { customerWhere } from "./customerList";
import { queuePhotoChecks, type Tx } from "./photoChecks";
import { customerScope, reviewsBank } from "@/lib/permissions";
import { parseCustomerFilters } from "@/lib/customerFilters";
import { checkItems, type PhotoCheckView } from "@/lib/photoCheck";
import { SMS_KIND_VOUCHER } from "@/lib/sms";
import { plain } from "@/lib/text";
import type { CustomerEditValues } from "@/lib/customerForm";
import type { CustomerBankStatus, CustomerStatus } from "@/lib/studentState";
import type { SessionUser } from "@/lib/types";

type Fail = { ok: false; message: string; status: 400 | 404 | 409 | 500; field?: string };
const fail = (message: string, status: Fail["status"], field?: string): Fail => ({ ok: false, message, status, field });
const NOT_FOUND = fail("Không tìm thấy hồ sơ.", 404);

export type DetailPhoto = { id: string; slotId: string; uploadedBy: string | null; createdAt: Date };
export type DetailSlot = { id: string; name: string; removed: boolean; photo: DetailPhoto | null };
export type DetailBank = {
  id: string;
  slot: number;
  bankId: string;
  name: string;
  status: CustomerBankStatus;
  referralCode: string;
  managers: string[];
  reviewer: string | null;
  reviewedAt: Date | null;
  managed: boolean;
  note: string;
  slots: DetailSlot[];
  photos: DetailPhoto[];
  check: PhotoCheckView | null;
};
export type CustomerDetail = {
  id: string;
  fullName: string;
  className: string;
  phone: string;
  parentName: string;
  parentPhone: string;
  status: CustomerStatus;
  schoolName: string;
  submittedAt: Date | null;
  lastSeenAt: Date | null;
  existingBanks: string[];
  duplicates: { id: string; fullName: string; schoolName: string }[];
  voucher: { code: string; issuedAt: Date } | null;
  sms: { status: "queued" | "sent" | "failed"; toPhone: string; sentAt: Date | null; attempts: number; error: string } | null;
  canEdit: boolean;
  banks: DetailBank[];
};

const uploader = alias(users, "uploader");

export async function getCustomerDetail(actor: SessionUser, id: string): Promise<CustomerDetail | null> {
  const [c] = await db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      nameSearch: customers.nameSearch,
      className: customers.className,
      phone: customers.phone,
      parentName: customers.parentName,
      parentPhone: customers.parentPhone,
      status: customers.status,
      schoolName: schools.name,
      submittedAt: customers.submittedAt,
      lastSeenAt: customers.lastSeenAt,
    })
    .from(customers)
    .innerJoin(schools, eq(schools.id, customers.schoolId))
    .where(eq(customers.id, id));
  if (!c) return null;
  const rows = await db
    .select({
      id: customerBanks.id,
      slot: customerBanks.slot,
      bankId: customerBanks.bankId,
      name: banks.name,
      status: customerBanks.status,
      referralCode: customerBanks.referralCode,
      reviewer: users.fullName,
      reviewedAt: customerBanks.reviewedAt,
      note: customerBanks.note,
    })
    .from(customerBanks)
    .innerJoin(banks, eq(banks.id, customerBanks.bankId))
    .leftJoin(users, eq(users.id, customerBanks.reviewedBy))
    .where(eq(customerBanks.customerId, id))
    .orderBy(asc(customerBanks.slot));
  if (!customerScope(actor).all && !rows.some((r) => reviewsBank(actor, r.bankId))) return null;

  const mine = rows.filter((r) => reviewsBank(actor, r.bankId));
  const mineIds = mine.map((r) => r.id);
  const bankIds = rows.map((r) => r.bankId);
  const [managers, slots, photos, checks, existing, duplicates, [voucher], [sms]] = await Promise.all([
    bankIds.length
      ? db
          .select({ bankId: userManagedBanks.bankId, name: users.fullName })
          .from(userManagedBanks)
          .innerJoin(users, and(eq(users.id, userManagedBanks.userId), eq(users.active, true)))
          .where(inArray(userManagedBanks.bankId, bankIds))
          .orderBy(asc(users.fullName))
      : [],
    mine.length ? db.select().from(bankPhotoSlots).where(inArray(bankPhotoSlots.bankId, mine.map((r) => r.bankId))).orderBy(asc(bankPhotoSlots.sortOrder), asc(bankPhotoSlots.name)) : [],
    mineIds.length
      ? db
          .select({ id: proofPhotos.id, customerBankId: proofPhotos.customerBankId, slotId: proofPhotos.slotId, uploadedBy: uploader.fullName, createdAt: proofPhotos.createdAt })
          .from(proofPhotos)
          .leftJoin(uploader, eq(uploader.id, proofPhotos.uploadedBy))
          .where(and(inArray(proofPhotos.customerBankId, mineIds), isNull(proofPhotos.replacedAt)))
      : [],
    mineIds.length
      ? db
          .selectDistinctOn([photoChecks.customerBankId])
          .from(photoChecks)
          .where(inArray(photoChecks.customerBankId, mineIds))
          .orderBy(photoChecks.customerBankId, desc(photoChecks.createdAt))
      : [],
    db.select({ name: banks.name }).from(customerExistingBanks).innerJoin(banks, eq(banks.id, customerExistingBanks.bankId)).where(eq(customerExistingBanks.customerId, id)).orderBy(asc(banks.sortOrder)),
    db
      .select({ id: customers.id, fullName: customers.fullName, schoolName: schools.name })
      .from(customers)
      .innerJoin(schools, eq(schools.id, customers.schoolId))
      .where(and(eq(customers.nameSearch, c.nameSearch), eq(customers.phone, c.phone), ne(customers.id, id), customerWhere(actor, parseCustomerFilters({}))))
      .orderBy(asc(customers.createdAt))
      .limit(10),
    db.select({ code: vouchers.code, issuedAt: vouchers.issuedAt }).from(vouchers).where(eq(vouchers.customerId, id)),
    db
      .select({ status: smsMessages.status, toPhone: smsMessages.toPhone, sentAt: smsMessages.sentAt, attempts: smsMessages.attempts, error: smsMessages.error })
      .from(smsMessages)
      .where(and(eq(smsMessages.customerId, id), eq(smsMessages.kind, SMS_KIND_VOUCHER))),
  ]);

  return {
    id: c.id,
    fullName: c.fullName,
    className: c.className,
    phone: c.phone,
    parentName: c.parentName,
    parentPhone: c.parentPhone,
    status: c.status,
    schoolName: c.schoolName,
    submittedAt: c.submittedAt,
    lastSeenAt: c.lastSeenAt,
    existingBanks: existing.map((e) => e.name),
    duplicates,
    voucher: voucher ?? null,
    sms: sms ?? null,
    canEdit: !voucher,
    banks: rows.map((r) => {
      const managed = mineIds.includes(r.id);
      const current = photos.filter((ph) => ph.customerBankId === r.id).map((ph) => ({ id: ph.id, slotId: ph.slotId, uploadedBy: ph.uploadedBy, createdAt: ph.createdAt }));
      const check = checks.find((ch) => ch.customerBankId === r.id);
      return {
        ...r,
        managed,
        managers: managers.filter((m) => m.bankId === r.bankId).map((m) => m.name),
        note: managed ? r.note : "",
        photos: current,
        // Khung đã bỏ vẫn hiện nếu còn ảnh đang dùng: ảnh đã nộp giữ tên khung.
        slots: managed
          ? slots
              .filter((s) => s.bankId === r.bankId && (!s.removedAt || current.some((ph) => ph.slotId === s.id)))
              .map((s) => ({ id: s.id, name: s.name, removed: Boolean(s.removedAt), photo: current.find((ph) => ph.slotId === s.id) ?? null }))
          : [],
        check: check
          ? { status: check.status, checkedAt: check.checkedAt?.toISOString() ?? null, passed: check.passed, total: check.total, error: check.error, items: checkItems(check.result) }
          : null,
      };
    }),
  };
}

export async function photoForView(actor: SessionUser, photoId: string, ip: string | null): Promise<{ ok: true; key: string } | Fail> {
  const [row] = await db
    .select({ key: proofPhotos.s3Key, bankId: customerBanks.bankId, customerId: customerBanks.customerId })
    .from(proofPhotos)
    .innerJoin(customerBanks, eq(customerBanks.id, proofPhotos.customerBankId))
    .where(eq(proofPhotos.id, photoId));
  if (!row || !reviewsBank(actor, row.bankId)) return fail("Không tìm thấy ảnh.", 404);
  await writeAudit(db, { userId: actor.id, action: "view_photo", targetType: "proof_photos", targetId: photoId, detail: { customerId: row.customerId, bankId: row.bankId }, ip });
  return { ok: true, key: row.key };
}

// Khoá dòng hồ sơ trước khi đọc: đánh dấu Đạt cấp voucher chạy cùng lúc thì một trong hai chờ.
export async function lockCustomer(tx: Tx, actor: SessionUser, id: string) {
  const [c] = await tx.select().from(customers).where(eq(customers.id, id)).for("update");
  if (!c) return null;
  const rows = await tx.select().from(customerBanks).where(eq(customerBanks.customerId, id));
  if (!customerScope(actor).all && !rows.some((r) => reviewsBank(actor, r.bankId))) return null;
  return { customer: c, rows };
}

export async function updateCustomerInfo(actor: SessionUser, id: string, values: CustomerEditValues, ip: string | null): Promise<{ ok: true } | Fail> {
  return db.transaction(async (tx) => {
    const locked = await lockCustomer(tx, actor, id);
    if (!locked) return NOT_FOUND;
    const { customer: before, rows } = locked;
    const [voucher] = await tx.select({ id: vouchers.id }).from(vouchers).where(eq(vouchers.customerId, id));
    if (voucher) return fail("Hồ sơ đã có voucher, không sửa được thông tin.", 409);
    await tx
      .update(customers)
      .set({ fullName: values.fullName, nameSearch: plain(values.fullName), className: values.className, phone: values.phone, parentName: values.parentName, parentPhone: values.parentPhone })
      .where(eq(customers.id, id));
    if (values.fullName !== before.fullName) {
      // Họ tên đổi thì kết quả tìm họ tên trên ảnh cũ không còn đúng; dòng chưa gửi kiểm tra sẽ được xếp lúc gửi.
      const sent = rows.filter((r) => r.status === "pending" || r.status === "failed");
      const named = sent.length
        ? await tx
            .selectDistinct({ bankId: bankPhotoSlots.bankId })
            .from(bankPhotoSlots)
            .where(and(inArray(bankPhotoSlots.bankId, sent.map((r) => r.bankId)), isNull(bankPhotoSlots.removedAt), eq(bankPhotoSlots.checkName, true)))
        : [];
      await queuePhotoChecks(
        tx,
        sent.filter((r) => named.some((n) => n.bankId === r.bankId)).map((r) => r.id),
      );
    }
    const pick = ({ fullName, className, phone, parentName, parentPhone }: CustomerEditValues) => ({ fullName, className, phone, parentName, parentPhone });
    await writeAudit(tx, { userId: actor.id, action: "update_customer", targetType: "customers", targetId: id, detail: { before: pick(before), after: pick(values) }, ip });
    return { ok: true as const };
  });
}

