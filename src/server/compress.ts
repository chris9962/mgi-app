import sharp from "sharp";
import { and, asc, eq, isNull, like, lt, lte, or, sql } from "drizzle-orm";
import { db } from "./db/client";
import { proofPhotos } from "./db/schema";
import { heicToJpeg } from "./heic";
import { deleteImage, imageExtOf, readImage, writeImage } from "./storage";

export const MAX_EDGE = 1600;
export const MAX_BYTES = 300 * 1024;
export const MAX_ATTEMPTS = 3;
export const BATCH = 20;
// Ảnh 48 MP đã tốn khoảng 1,2 GB RAM khi giải mã; ảnh lớn hơn trần thì lần thử lỗi thay vì làm chết worker.
const MAX_INPUT_PIXELS = 100_000_000;
// Bậc chất lượng chép từ mgst-app: dừng ở bậc đầu tiên lọt trần, ảnh nền phẳng đạt ngay ở 85.
const QUALITY_STEPS = [85, 80, 75, 70];

export type CompressStore = {
  read: (key: string) => Promise<Uint8Array | null>;
  write: (key: string, bytes: Uint8Array) => Promise<void>;
  remove: (key: string) => Promise<void>;
};
export const s3CompressStore: CompressStore = { read: readImage, write: writeImage, remove: deleteImage };

// Định dạng nhận theo nội dung, không theo đuôi khoá: điện thoại khai sai loại thì HEIC vẫn nằm dưới khoá .jpg.
export async function toWebp(bytes: Uint8Array): Promise<Uint8Array> {
  const src = Buffer.from(imageExtOf(bytes) === "heic" ? await heicToJpeg(bytes) : bytes);
  let out = Buffer.alloc(0);
  for (const quality of QUALITY_STEPS) {
    // failOn none: JPEG thiếu vài byte cuối vẫn dựng được phần đã có, như mgst-app.
    out = await sharp(src, { failOn: "none", limitInputPixels: MAX_INPUT_PIXELS }).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
    if (out.length <= MAX_BYTES) break;
  }
  return new Uint8Array(out);
}

// Thử lại sau 5 phút nhân số lần đã thử: lỗi S3 thoáng qua không đốt hết 3 lần, và lần đang chạy dở của worker đã chết được lấy lại.
const retryDue = or(isNull(proofPhotos.compressTriedAt), lt(proofPhotos.compressTriedAt, sql`now() - interval '5 minutes' * ${proofPhotos.compressAttempts}`));

// Ảnh nén lỗi 3 lần vẫn nằm trong chỉ mục compressed_at is null, nên phải lọc số lần thử ở đây.
export async function compressQueue(limit = BATCH): Promise<string[]> {
  const rows = await db
    .select({ id: proofPhotos.id })
    .from(proofPhotos)
    .where(and(isNull(proofPhotos.compressedAt), lt(proofPhotos.compressAttempts, MAX_ATTEMPTS), retryDue))
    .orderBy(asc(proofPhotos.createdAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

export type CompressOutcome = "compressed" | "kept" | "failed" | "skipped";

const ioTimeoutMs = () => Number(process.env.COMPRESS_TIMEOUT_MS) || 60_000;

// S3 treo thì lần thử này lỗi và worker đi tiếp, không đứng mãi ở một ảnh.
async function withTimeout<T>(work: Promise<T>, what: string): Promise<T> {
  const ms = ioTimeoutMs();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${what} quá ${Math.round(ms / 1000)} giây.`)), ms);
  });
  try {
    return await Promise.race([work, expired]);
  } finally {
    clearTimeout(timer);
  }
}

// Khoá webp giữ uuid của ảnh gốc nên có thể trùng khoá một dòng đang dùng: chỉ xoá khi không dòng nào trỏ tới.
async function removeIfUnused(store: CompressStore, key: string) {
  const [used] = await db.select({ id: proofPhotos.id }).from(proofPhotos).where(eq(proofPhotos.s3Key, key));
  if (!used) await store.remove(key).catch((e) => console.error("[compress] không xoá được ảnh vừa nén trên S3:", key, e));
}

// Không giữ transaction hay khoá dòng lúc tải, nén, ghi: S3 treo hay ảnh lớn không chặn học sinh chụp lại hoặc gửi kiểm tra.
export async function compressOne(id: string, store: CompressStore = s3CompressStore): Promise<CompressOutcome> {
  const kept = await db
    .update(proofPhotos)
    .set({ compressedAt: new Date() })
    .where(and(eq(proofPhotos.id, id), isNull(proofPhotos.compressedAt), like(proofPhotos.s3Key, "%.webp"), lte(proofPhotos.sizeBytes, MAX_BYTES)))
    .returning({ id: proofPhotos.id });
  if (kept.length) return "kept";
  // Ghi lần thử và commit trước khi tải: tiến trình chết giữa chừng (hết RAM với ảnh lớn) vẫn tính một lần, không kẹt mãi ở ảnh cũ nhất.
  const [row] = await db
    .update(proofPhotos)
    .set({ compressAttempts: sql`${proofPhotos.compressAttempts} + 1`, compressTriedAt: sql`now()` })
    .where(and(eq(proofPhotos.id, id), isNull(proofPhotos.compressedAt), lt(proofPhotos.compressAttempts, MAX_ATTEMPTS), retryDue))
    .returning({ key: proofPhotos.s3Key });
  if (!row) return "skipped";
  // Giữ thư mục, ngày và uuid, chỉ đổi đuôi: ảnh đã là webp thì ghi đè đúng khoá cũ.
  const key = row.key.replace(/\.[a-z]+$/, ".webp");
  let written = false;
  try {
    const bytes = await withTimeout(store.read(row.key), "Tải ảnh");
    if (!bytes) throw new Error("Không tải được ảnh từ S3.");
    const out = await toWebp(bytes);
    await withTimeout(store.write(key, out), "Ghi ảnh");
    written = true;
    // Dòng đổi trong lúc nén (học sinh chụp lại xoá dòng cũ) thì ghi vào 0 dòng và bỏ ảnh vừa nén.
    const done = await db
      .update(proofPhotos)
      .set({ s3Key: key, sizeBytes: out.length, compressedAt: new Date() })
      .where(and(eq(proofPhotos.id, id), eq(proofPhotos.s3Key, row.key), isNull(proofPhotos.compressedAt)))
      .returning({ id: proofPhotos.id });
    if (!done.length) {
      await removeIfUnused(store, key);
      return "skipped";
    }
  } catch (e) {
    console.error("[compress] không nén được ảnh", id, e);
    if (written) await removeIfUnused(store, key);
    return "failed";
  }
  if (key !== row.key) await store.remove(row.key).catch((e) => console.error("[compress] không xoá được ảnh gốc trên S3:", row.key, e));
  return "compressed";
}

// Lô đầy thì quét tiếp ngay; lô có ảnh lỗi thì chờ vòng sau, S3 đứt một lúc không đốt hết 3 lần thử trong vài giây.
export const runAgainNow = (t: Record<CompressOutcome, number>): boolean => t.failed === 0 && t.compressed + t.kept + t.skipped >= BATCH;

// Một vòng của worker; stopped() đúng thì dừng sau ảnh đang nén, không bỏ dở dòng nào.
export async function runCompressQueue(store: CompressStore = s3CompressStore, stopped: () => boolean = () => false): Promise<Record<CompressOutcome, number>> {
  const tally: Record<CompressOutcome, number> = { compressed: 0, kept: 0, failed: 0, skipped: 0 };
  for (const id of await compressQueue()) {
    if (stopped()) break;
    tally[await compressOne(id, store)] += 1;
  }
  return tally;
}
