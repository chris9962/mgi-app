import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "./db/client";
import { bankPhotoSlots, customerBanks, customers, proofPhotos } from "./db/schema";
import { deleteImage, headSize, MAX_IMAGE_BYTES, newKey, presignGet, presignPut } from "./storage";
import { extForMime, isImageKey } from "@/lib/imageKey";
import type { Customer } from "./customers";

export type PhotoStore = {
  presignPut: (key: string, contentType: string) => Promise<string>;
  headSize: (key: string) => Promise<number | null>;
  remove: (key: string) => Promise<void>;
  signGet: (key: string) => Promise<string>;
};

// Học sinh ở lâu trên B3 trong lúc mở tài khoản ở app ngân hàng; link xem ảnh sống 1 giờ, web lấy link mới mỗi lần quay lại.
export const s3PhotoStore: PhotoStore = { presignPut, headSize, remove: deleteImage, signGet: (key) => presignGet(key, 3600) };

type Fail = { ok: false; message: string; status: 400 | 404 | 409; field?: string };
const fail = (message: string, status: Fail["status"], field?: string): Fail => ({ ok: false, message, status, field });
const LOCKED = fail("Hồ sơ đã gửi kiểm tra.", 409);

type Executor = Pick<typeof db, "select">;
export type PhotoTarget = { customerBankId: string; slotId: string };

// Dòng ngân hàng phải là của học sinh và đang chọn; khung phải thuộc đúng ngân hàng đó và chưa bỏ. DB không ràng buộc được điều này.
async function targetFound(ex: Executor, customerId: string, t: PhotoTarget): Promise<boolean> {
  const [row] = await ex
    .select({ id: bankPhotoSlots.id })
    .from(customerBanks)
    .innerJoin(bankPhotoSlots, and(eq(bankPhotoSlots.bankId, customerBanks.bankId), eq(bankPhotoSlots.id, t.slotId), isNull(bankPhotoSlots.removedAt)))
    .where(and(eq(customerBanks.id, t.customerBankId), eq(customerBanks.customerId, customerId), eq(customerBanks.status, "selected")));
  return Boolean(row);
}

async function removeQuietly(store: PhotoStore, keys: string[]) {
  for (const key of keys) await store.remove(key).catch((e) => console.error("[photos] không xoá được ảnh trên S3:", key, e));
}

export async function photoUploadUrl(customer: Customer, input: PhotoTarget & { contentType: string }, store = s3PhotoStore): Promise<{ ok: true; url: string; key: string } | Fail> {
  if (customer.status !== "banks_selected") return LOCKED;
  const ext = extForMime(input.contentType);
  if (!ext) return fail("Chỉ nhận ảnh.", 400, "contentType");
  if (!(await targetFound(db, customer.id, input))) return fail("Không tìm thấy khung ảnh.", 404);
  const key = newKey("proofs", ext);
  return { ok: true, key, url: await store.presignPut(key, input.contentType) };
}

export async function recordPhoto(customer: Customer, input: PhotoTarget & { key: string }, store = s3PhotoStore): Promise<{ ok: true } | Fail> {
  if (!isImageKey(input.key, "proofs")) return fail("Khoá ảnh không hợp lệ.", 400, "key");
  const [same] = await db.select().from(proofPhotos).where(eq(proofPhotos.s3Key, input.key));
  if (same) return same.customerBankId === input.customerBankId && same.slotId === input.slotId && !same.replacedAt ? { ok: true } : fail("Ảnh đã ghi.", 409, "key");
  const size = await store.headSize(input.key);
  if (!size) return fail("Chưa tải được ảnh lên. Thử lại.", 400, "key");
  if (size > MAX_IMAGE_BYTES) {
    await removeQuietly(store, [input.key]);
    return fail("Ảnh lớn hơn 10 MB.", 400, "key");
  }
  const r = await db.transaction(async (tx) => {
    // Khoá hồ sơ: Gửi kiểm tra chạy cùng lúc thì một trong hai chờ, ảnh không lọt vào hồ sơ đã khoá.
    const [current] = await tx.select({ status: customers.status }).from(customers).where(eq(customers.id, customer.id)).for("update");
    if (current?.status !== "banks_selected") return LOCKED;
    if (!(await targetFound(tx, customer.id, input))) return fail("Không tìm thấy khung ảnh.", 404);
    const old = await tx
      .delete(proofPhotos)
      .where(and(eq(proofPhotos.customerBankId, input.customerBankId), eq(proofPhotos.slotId, input.slotId), isNull(proofPhotos.replacedAt)))
      .returning({ key: proofPhotos.s3Key });
    await tx.insert(proofPhotos).values({ customerBankId: input.customerBankId, slotId: input.slotId, s3Key: input.key, sizeBytes: size });
    return { ok: true as const, oldKeys: old.map((o) => o.key) };
  });
  // Xoá object sau commit: transaction lỗi thì ảnh cũ vẫn còn nguyên trên S3.
  await removeQuietly(store, r.ok ? r.oldKeys : [input.key]);
  return r.ok ? { ok: true } : r;
}

export async function cancelBanks(customer: Customer, store = s3PhotoStore): Promise<{ ok: true } | Fail> {
  const r = await db.transaction(async (tx) => {
    const [current] = await tx.select({ status: customers.status }).from(customers).where(eq(customers.id, customer.id)).for("update");
    if (current?.status !== "banks_selected") return fail("Hồ sơ không ở bước mở tài khoản.", 409);
    const selected = await tx
      .select({ id: customerBanks.id })
      .from(customerBanks)
      .where(and(eq(customerBanks.customerId, customer.id), eq(customerBanks.status, "selected")));
    const ids = selected.map((s) => s.id);
    // Đọc khoá ảnh trước khi xoá: xoá dòng ngân hàng thì cascade xoá luôn dòng ảnh.
    const keys = ids.length ? (await tx.select({ key: proofPhotos.s3Key }).from(proofPhotos).where(inArray(proofPhotos.customerBankId, ids))).map((p) => p.key) : [];
    if (ids.length) await tx.delete(customerBanks).where(inArray(customerBanks.id, ids));
    await tx.update(customers).set({ status: "new" }).where(eq(customers.id, customer.id));
    return { ok: true as const, keys };
  });
  if (!r.ok) return r;
  await removeQuietly(store, r.keys);
  return { ok: true };
}
