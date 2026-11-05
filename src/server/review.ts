import { and, count, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "./db/client";
import { bankPhotoSlots, banks, customerBanks, customers, proofPhotos, reviewEvents, schools, smsMessages, vouchers, wards } from "./db/schema";
import { writeAudit } from "./audit";
import { queuePhotoChecks } from "./photoChecks";
import { getSettings } from "./settings";
import { deleteImage, putImage } from "./storage";
import { voucherCode, voucherSecret } from "./voucher";
import { reviewsBank } from "@/lib/permissions";
import { renderSms, SMS_KIND_VOUCHER } from "@/lib/sms";
import { nameForExcel, removeDiacritics } from "@/lib/text";
import type { CustomerBankStatus } from "@/lib/studentState";
import type { SessionUser } from "@/lib/types";

type Fail = { ok: false; message: string; status: 400 | 404 | 409 | 500; field?: string };
const fail = (message: string, status: Fail["status"], field?: string): Fail => ({ ok: false, message, status, field });
const NOT_FOUND = fail("Không tìm thấy ngân hàng của hồ sơ.", 404);
const TAKEN = fail("Ngân hàng này đã có người đánh dấu. Tải lại trang để xem kết quả mới.", 409);

export type ReviewInput = { customerBankId: string; result: "passed" | "failed"; expected: CustomerBankStatus };

async function targetOf(actor: SessionUser, customerBankId: string) {
  const [row] = await db.select({ customerId: customerBanks.customerId, bankId: customerBanks.bankId, status: customerBanks.status }).from(customerBanks).where(eq(customerBanks.id, customerBankId));
  return row && reviewsBank(actor, row.bankId) ? row : null;
}

const transitionError = (from: CustomerBankStatus): Fail =>
  from === "passed" ? fail("Ngân hàng đã Đạt, không đổi được kết quả.", 409) : from === "selected" ? fail("Học sinh chưa gửi kiểm tra.", 409) : fail("Ngân hàng đã Không đạt, chỉ đổi được sang Đạt.", 409);

export async function reviewCustomerBank(actor: SessionUser, input: ReviewInput, ip: string | null): Promise<{ ok: true } | Fail> {
  const target = await targetOf(actor, input.customerBankId);
  if (!target) return NOT_FOUND;
  const settings = await getSettings();
  return db.transaction(async (tx) => {
    // Khoá dòng hồ sơ trước: hai người kiểm hai ngân hàng của một học sinh không cùng cấp voucher, không tạo hai SMS.
    const [c] = await tx
      .select({
        id: customers.id,
        fullName: customers.fullName,
        className: customers.className,
        parentName: customers.parentName,
        parentPhone: customers.parentPhone,
        status: customers.status,
        firstPassedAt: customers.firstPassedAt,
        schoolName: schools.name,
        wardCode: schools.wardCode,
        provinceCode: wards.provinceCode,
      })
      .from(customers)
      .innerJoin(schools, eq(schools.id, customers.schoolId))
      .innerJoin(wards, eq(wards.code, schools.wardCode))
      .where(eq(customers.id, target.customerId))
      .for("update", { of: customers });
    const [row] = await tx.select({ status: customerBanks.status, bankName: banks.name }).from(customerBanks).innerJoin(banks, eq(banks.id, customerBanks.bankId)).where(eq(customerBanks.id, input.customerBankId));
    if (row.status !== input.expected) return TAKEN;
    const from = row.status;
    if (!(from === "pending" || (from === "failed" && input.result === "passed"))) return transitionError(from);
    const issue = input.result === "passed" && !c.firstPassedAt;
    const secret = voucherSecret();
    if (issue && !secret) return fail("Máy chủ chưa cài khoá voucher (VOUCHER_SECRET), chưa đánh dấu Đạt được.", 500);

    const now = new Date();
    const updated = await tx
      .update(customerBanks)
      .set({ status: input.result, reviewedAt: now, reviewedBy: actor.id })
      .where(and(eq(customerBanks.id, input.customerBankId), eq(customerBanks.status, from)))
      .returning({ id: customerBanks.id });
    if (!updated.length) return TAKEN;
    await tx.insert(reviewEvents).values({ customerBankId: input.customerBankId, userId: actor.id, result: input.result, previousResult: from === "pending" ? null : from });

    let code: string | undefined;
    if (issue) {
      code = voucherCode({ customerId: c.id, provinceCode: c.provinceCode, wardCode: c.wardCode, parentName: c.parentName, schoolName: c.schoolName, fullName: c.fullName, className: c.className }, secret!);
      await tx.update(customers).set({ firstPassedAt: now }).where(eq(customers.id, c.id));
      await tx.insert(vouchers).values({ code, customerId: c.id, issuedAt: now });
      const body = renderSms(settings.smsTemplate, {
        HO_TEN: nameForExcel(c.fullName),
        LOP: c.className,
        TRUONG: removeDiacritics(c.schoolName),
        NGAN_HANG: removeDiacritics(row.bankName),
        MA_VOUCHER: code,
      });
      const [sms] = await tx.insert(smsMessages).values({ customerId: c.id, kind: SMS_KIND_VOUCHER, toPhone: c.parentPhone, body }).returning({ id: smsMessages.id });
      // Worker SMS nghe kênh này; Postgres chỉ phát sau commit.
      await tx.execute(sql`select pg_notify('sms_messages', ${sms.id})`);
    }

    const [left] = await tx.select({ n: count() }).from(customerBanks).where(and(eq(customerBanks.customerId, c.id), eq(customerBanks.status, "pending")));
    if (left.n === 0 && c.status === "pending_review") await tx.update(customers).set({ status: "reviewed" }).where(eq(customers.id, c.id));
    await writeAudit(tx, { userId: actor.id, action: "review_customer_bank", targetType: "customer_banks", targetId: input.customerBankId, detail: { from, to: input.result, voucher: code ?? null }, ip });
    return { ok: true as const };
  });
}

export async function saveNote(actor: SessionUser, customerBankId: string, note: string, ip: string | null): Promise<{ ok: true } | Fail> {
  const target = await targetOf(actor, customerBankId);
  if (!target) return NOT_FOUND;
  return db.transaction(async (tx) => {
    const [before] = await tx.select({ note: customerBanks.note }).from(customerBanks).where(eq(customerBanks.id, customerBankId)).for("update");
    await tx.update(customerBanks).set({ note }).where(eq(customerBanks.id, customerBankId));
    await writeAudit(tx, { userId: actor.id, action: "save_review_note", targetType: "customer_banks", targetId: customerBankId, detail: { before: before.note, after: note }, ip });
    return { ok: true as const };
  });
}

export type AdminPhotoStore = {
  put: (bytes: Uint8Array) => Promise<{ ok: true; key: string; size: number } | { ok: false; message: string }>;
  remove: (key: string) => Promise<void>;
};

const s3AdminPhotoStore: AdminPhotoStore = {
  put: async (bytes) => {
    const r = await putImage(bytes, "proofs");
    return r.ok ? { ok: true, key: r.key, size: bytes.length } : r;
  },
  remove: deleteImage,
};

// Ảnh thay thế đi qua máy chủ để kiểm chữ ký file; ảnh cũ giữ lại với replaced_at.
export async function replacePhoto(
  actor: SessionUser,
  input: { customerBankId: string; slotId: string },
  bytes: Uint8Array,
  ip: string | null,
  store: AdminPhotoStore = s3AdminPhotoStore,
): Promise<{ ok: true } | Fail> {
  const target = await targetOf(actor, input.customerBankId);
  if (!target) return NOT_FOUND;
  const [slot] = await db
    .select({ id: bankPhotoSlots.id })
    .from(bankPhotoSlots)
    .where(and(eq(bankPhotoSlots.id, input.slotId), eq(bankPhotoSlots.bankId, target.bankId), isNull(bankPhotoSlots.removedAt)));
  if (!slot) return fail("Không tìm thấy khung ảnh.", 404, "slotId");
  if (target.status !== "pending" && target.status !== "failed") return target.status === "passed" ? fail("Ngân hàng đã Đạt, không thay được ảnh.", 409) : transitionError(target.status);

  const up = await store.put(bytes);
  if (!up.ok) return fail(up.message, 400, "file");
  const r = await db.transaction(async (tx) => {
    await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, target.customerId)).for("update");
    const [row] = await tx.select({ status: customerBanks.status }).from(customerBanks).where(eq(customerBanks.id, input.customerBankId));
    if (row.status === "passed") return fail("Ngân hàng đã Đạt, không thay được ảnh.", 409);
    const now = new Date();
    const old = await tx
      .update(proofPhotos)
      .set({ replacedAt: now })
      .where(and(eq(proofPhotos.customerBankId, input.customerBankId), eq(proofPhotos.slotId, input.slotId), isNull(proofPhotos.replacedAt)))
      .returning({ id: proofPhotos.id });
    const [created] = await tx
      .insert(proofPhotos)
      .values({ customerBankId: input.customerBankId, slotId: input.slotId, s3Key: up.key, sizeBytes: up.size, uploadedBy: actor.id })
      .returning({ id: proofPhotos.id });
    const [checked] = await tx
      .select({ n: count() })
      .from(bankPhotoSlots)
      .where(and(eq(bankPhotoSlots.bankId, target.bankId), isNull(bankPhotoSlots.removedAt), or(eq(bankPhotoSlots.checkName, true), eq(bankPhotoSlots.checkCode, true))));
    if (checked.n > 0) await queuePhotoChecks(tx, [input.customerBankId]);
    await writeAudit(tx, {
      userId: actor.id,
      action: "replace_photo",
      targetType: "customer_banks",
      targetId: input.customerBankId,
      detail: { slotId: input.slotId, replaced: old.map((o) => o.id), photoId: created.id },
      ip,
    });
    return { ok: true as const };
  });
  if (!r.ok) await store.remove(up.key).catch((e) => console.error("[review] không xoá được ảnh thay thế trên S3:", up.key, e));
  return r;
}

