import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "./db/client";
import { bankPhotoSlots, customerBanks, customers, photoChecks, proofPhotos } from "./db/schema";
import { heicToJpeg } from "./heic";
import { judgeSlot, partsOf, type CheckValues } from "./ocr/judge";
import { ocrLines } from "./ocr/reader";
import { imageExtOf, readImage } from "./storage";
import { ofSchools } from "./workerScope";
import type { PhotoCheckItem } from "@/lib/photoCheck";

// Nửa worker của kiểm ảnh. Nửa xếp lượt nằm ở photoChecks.ts, chạy trong app; file này kéo theo tiến trình OCR nên chỉ worker import.
export const PHOTO_CHECK_CHANNEL = "photo_checks";
export const BATCH = 20;
// Một lượt đọc vài ảnh, mỗi ảnh vài giây: giữ quá 5 phút nghĩa là worker giữ lượt đã chết.
const claimable = or(isNull(photoChecks.claimedAt), lt(photoChecks.claimedAt, sql`now() - interval '5 minutes'`));
export const MAX_CLAIMS = 3;

export type PhotoCheckDeps = {
  read: (key: string) => Promise<Uint8Array | null>;
  ocr: (image: Uint8Array, code?: string) => Promise<string[]>;
};
export const ocrDeps: PhotoCheckDeps = { read: readImage, ocr: ocrLines };

export async function pendingPhotoCheckIds(limit = BATCH, schoolIds?: string[]): Promise<string[]> {
  const rows = await db
    .select({ id: photoChecks.id })
    .from(photoChecks)
    .where(and(eq(photoChecks.status, "pending"), claimable, ofSchools(photoChecks.customerBankId, schoolIds)))
    .orderBy(asc(photoChecks.createdAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

export type CheckOutcome = "done" | "failed" | "dropped" | "skipped";

// Nhận lượt bằng một câu update, không giữ khoá dòng suốt lúc đọc: xếp lượt mới phải xoá được lượt đang đọc.
// Hai worker cùng nhận thì câu sau chờ câu trước commit rồi thấy lượt đã có người giữ.
async function claim(id: string): Promise<{ customerBankId: string; claims: number } | null> {
  const [row] = await db
    .update(photoChecks)
    .set({ claimedAt: sql`now()`, claims: sql`${photoChecks.claims} + 1` })
    .where(and(eq(photoChecks.id, id), eq(photoChecks.status, "pending"), claimable))
    .returning({ customerBankId: photoChecks.customerBankId, claims: photoChecks.claims });
  return row ?? null;
}

// Ảnh máy chủ không đổi được sang WebP lúc nhận thì giữ HEIC gốc; OCR không đọc được HEIC nên đổi sang JPEG.
async function photoBytes(photoId: string, slotName: string, read: PhotoCheckDeps["read"]): Promise<Uint8Array> {
  const [row] = await db.select({ key: proofPhotos.s3Key }).from(proofPhotos).where(eq(proofPhotos.id, photoId));
  const bytes = row ? await read(row.key) : null;
  if (!bytes) throw new Error(`Không tải được ảnh ${slotName}.`);
  return imageExtOf(bytes) === "heic" ? heicToJpeg(bytes) : bytes;
}

// Mỗi khung chỉ so với ảnh đang dùng của chính khung đó, không đoán ảnh là màn nào, không tìm sang ảnh khác.
async function judgeBank(customerBankId: string, deps: PhotoCheckDeps): Promise<PhotoCheckItem[]> {
  const [cb] = await db
    .select({ bankId: customerBanks.bankId, referralCode: customerBanks.referralCode, fullName: customers.fullName })
    .from(customerBanks)
    .innerJoin(customers, eq(customers.id, customerBanks.customerId))
    .where(eq(customerBanks.id, customerBankId));
  if (!cb) return [];
  const values: CheckValues = { fullName: cb.fullName, referralCode: cb.referralCode };
  const slots = await db
    .select({ slotId: bankPhotoSlots.id, slotName: bankPhotoSlots.name, checkName: bankPhotoSlots.checkName, checkCode: bankPhotoSlots.checkCode })
    .from(bankPhotoSlots)
    .where(and(eq(bankPhotoSlots.bankId, cb.bankId), isNull(bankPhotoSlots.removedAt)))
    .orderBy(asc(bankPhotoSlots.sortOrder), asc(bankPhotoSlots.name));
  const checked = slots.filter((s) => {
    const parts = partsOf(s, values);
    return parts.name || parts.code;
  });
  if (!checked.length) return [];
  const photos = await db
    .select({ id: proofPhotos.id, slotId: proofPhotos.slotId })
    .from(proofPhotos)
    .where(and(eq(proofPhotos.customerBankId, customerBankId), isNull(proofPhotos.replacedAt)));
  const items: PhotoCheckItem[] = [];
  for (const slot of checked) {
    const photo = photos.find((ph) => ph.slotId === slot.slotId);
    const code = partsOf(slot, values).code ? values.referralCode : undefined;
    const lines = photo ? await deps.ocr(await photoBytes(photo.id, slot.slotName, deps.read), code) : null;
    items.push(judgeSlot(slot, lines, values));
  }
  return items;
}

// Kết quả chỉ để gợi ý: không đổi trạng thái customer_banks. Lỗi máy ghi failed kèm lý do, không thử lại.
export async function runPhotoCheck(id: string, deps: PhotoCheckDeps = ocrDeps): Promise<CheckOutcome> {
  const claimed = await claim(id);
  if (!claimed) return "skipped";
  const { customerBankId } = claimed;
  // Lượt bị xếp lượt mới xoá trong lúc đọc thì kết quả là của ảnh hoặc họ tên cũ: ghi vào 0 dòng và bỏ.
  const stillPending = and(eq(photoChecks.id, id), eq(photoChecks.status, "pending"));
  if (claimed.claims > MAX_CLAIMS) {
    const error = `Máy kiểm ảnh dừng giữa chừng ${MAX_CLAIMS} lần với lượt này.`;
    const written = await db.update(photoChecks).set({ status: "failed", error, checkedAt: new Date() }).where(stillPending).returning({ id: photoChecks.id });
    return written.length ? "failed" : "dropped";
  }
  try {
    const items = await judgeBank(customerBankId, deps);
    if (!items.length) {
      // Ngân hàng đã tắt hết khung kiểm sau lúc xếp lượt: không có gì để kiểm, xoá lượt chờ thay vì ghi 0/0.
      await db.delete(photoChecks).where(stillPending);
      return "dropped";
    }
    const written = await db
      .update(photoChecks)
      .set({ status: "done", result: items, passed: items.filter((i) => i.passed).length, total: items.length, error: "", checkedAt: new Date() })
      .where(stillPending)
      .returning({ id: photoChecks.id });
    return written.length ? "done" : "dropped";
  } catch (e) {
    const error = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    const written = await db.update(photoChecks).set({ status: "failed", error, checkedAt: new Date() }).where(stillPending).returning({ id: photoChecks.id });
    return written.length ? "failed" : "dropped";
  }
}

// Một vòng của worker: tối đa BATCH lượt cũ nhất; stopped() đúng thì dừng sau lượt đang đọc.
export async function runPhotoCheckRound(deps: PhotoCheckDeps = ocrDeps, stopped: () => boolean = () => false, schoolIds?: string[]): Promise<Record<CheckOutcome, number>> {
  const tally: Record<CheckOutcome, number> = { done: 0, failed: 0, dropped: 0, skipped: 0 };
  for (const id of await pendingPhotoCheckIds(BATCH, schoolIds)) {
    if (stopped()) break;
    tally[await runPhotoCheck(id, deps)] += 1;
  }
  return tally;
}
