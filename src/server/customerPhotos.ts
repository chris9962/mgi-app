import { and, eq, inArray, isNull } from "drizzle-orm";
import { syncCustomerStatus } from "./customerStatus";
import { db } from "./db/client";
import { bankPhotoSlots, customerBanks, customers, proofPhotos, schools } from "./db/schema";
import { deleteImage, presignGet, putImage, type PutResult } from "./storage";
import type { Customer } from "./customers";

export type PhotoStore = {
  put: (bytes: Uint8Array) => Promise<PutResult>;
  remove: (key: string) => Promise<void>;
  signGet: (key: string) => Promise<string>;
};

// Học sinh ở lâu trên B3 trong lúc mở tài khoản ở app ngân hàng; link xem ảnh sống 1 giờ, web lấy link mới mỗi lần quay lại.
export const s3PhotoStore: PhotoStore = { put: (bytes) => putImage(bytes, "proofs"), remove: deleteImage, signGet: (key) => presignGet(key, 3600) };

type Fail = { ok: false; message: string; status: 400 | 404 | 409; field?: string };
const fail = (message: string, status: Fail["status"], field?: string): Fail => ({ ok: false, message, status, field });
const LOCKED = fail("Hồ sơ đã gửi kiểm tra.", 409);

type Executor = Pick<typeof db, "select">;
export type PhotoTarget = { customerBankId: string; slotId: string };

// Còn dòng ngân hàng đang chọn thì hồ sơ còn ở bước 3, kể cả khi đã gửi kiểm tra ngân hàng khác.
async function hasSelectedRows(ex: Executor, customerId: string): Promise<boolean> {
  const rows = await ex.select({ id: customerBanks.id }).from(customerBanks).where(and(eq(customerBanks.customerId, customerId), eq(customerBanks.status, "selected"))).limit(1);
  return rows.length > 0;
}

// Dòng ngân hàng phải là của học sinh và đang chọn; khung phải thuộc đúng ngân hàng đó và chưa bỏ. DB không ràng buộc được điều này.
async function targetFound(ex: Executor, customerId: string, t: PhotoTarget): Promise<boolean> {
  const [row] = await ex
    .select({ id: bankPhotoSlots.id })
    .from(customerBanks)
    .innerJoin(bankPhotoSlots, and(eq(bankPhotoSlots.bankId, customerBanks.bankId), eq(bankPhotoSlots.id, t.slotId), isNull(bankPhotoSlots.removedAt)))
    .where(and(eq(customerBanks.id, t.customerBankId), eq(customerBanks.customerId, customerId), eq(customerBanks.status, "selected")));
  return Boolean(row);
}

export async function removeQuietly(store: Pick<PhotoStore, "remove">, keys: string[]) {
  for (const key of keys) await store.remove(key).catch((e) => console.error("[photos] không xoá được ảnh trên S3:", key, e));
}

// Kiểm trước khi ghi S3 để request bị từ chối không để lại object; kiểm lại trong transaction vì hồ sơ có thể đổi lúc đang ghi.
export async function uploadPhoto(customer: Customer, input: PhotoTarget, bytes: Uint8Array, store = s3PhotoStore): Promise<{ ok: true } | Fail> {
  if (!(await hasSelectedRows(db, customer.id))) return LOCKED;
  if (!(await targetFound(db, customer.id, input))) return fail("Không tìm thấy khung ảnh.", 404);
  const up = await store.put(bytes);
  if (!up.ok) return fail(up.message, 400, "file");
  const r = await db
    .transaction(async (tx) => {
      // Khoá hồ sơ: Gửi kiểm tra hay lần gửi khác cùng khung chạy cùng lúc thì một bên chờ, khung chỉ còn một ảnh.
      await tx.select({ id: customers.id }).from(customers).where(eq(customers.id, customer.id)).for("update");
      if (!(await hasSelectedRows(tx, customer.id))) return LOCKED;
      if (!(await targetFound(tx, customer.id, input))) return fail("Không tìm thấy khung ảnh.", 404);
      const old = await tx
        .delete(proofPhotos)
        .where(and(eq(proofPhotos.customerBankId, input.customerBankId), eq(proofPhotos.slotId, input.slotId), isNull(proofPhotos.replacedAt)))
        .returning({ key: proofPhotos.s3Key });
      await tx.insert(proofPhotos).values({ customerBankId: input.customerBankId, slotId: input.slotId, s3Key: up.key, sizeBytes: up.size });
      return { ok: true as const, oldKeys: old.map((o) => o.key) };
    })
    .catch(async (e) => {
      await removeQuietly(store, [up.key]);
      throw e;
    });
  // Xoá ảnh cũ sau commit: transaction lỗi thì ảnh cũ vẫn còn nguyên trên S3.
  await removeQuietly(store, r.ok ? r.oldKeys : [up.key]);
  return r.ok ? { ok: true } : r;
}

export async function cancelBanks(customer: Customer, store = s3PhotoStore): Promise<{ ok: true } | Fail> {
  const r = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({ status: customers.status, schoolActive: schools.active })
      .from(customers)
      .innerJoin(schools, eq(schools.id, customers.schoolId))
      .where(eq(customers.id, customer.id))
      .for("update", { of: customers });
    if (!current) return fail("Hồ sơ không ở bước mở tài khoản.", 409);
    const selected = await tx
      .select({ id: customerBanks.id })
      .from(customerBanks)
      .where(and(eq(customerBanks.customerId, customer.id), eq(customerBanks.status, "selected")));
    // Chỉ bỏ dòng đang chọn; dòng đã gửi kiểm tra giữ nguyên.
    if (!selected.length) return fail("Hồ sơ không ở bước mở tài khoản.", 409);
    // Trường đã đóng thì bỏ chỗ là mất luôn, không chọn lại được.
    if (!current.schoolActive) return fail("Trường đã đóng.", 409);
    const ids = selected.map((s) => s.id);
    // Đọc khoá ảnh trước khi xoá: xoá dòng ngân hàng thì cascade xoá luôn dòng ảnh.
    const keys = ids.length ? (await tx.select({ key: proofPhotos.s3Key }).from(proofPhotos).where(inArray(proofPhotos.customerBankId, ids))).map((p) => p.key) : [];
    await tx.delete(customerBanks).where(inArray(customerBanks.id, ids));
    await syncCustomerStatus(tx, customer.id);
    return { ok: true as const, keys };
  });
  if (!r.ok) return r;
  await removeQuietly(store, r.keys);
  return { ok: true };
}
