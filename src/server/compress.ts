import convert from "heic-convert";
import sharp from "sharp";
import { and, asc, eq, isNull, lt } from "drizzle-orm";
import { db } from "./db/client";
import { proofPhotos } from "./db/schema";
import { deleteImage, readImage, writeImage } from "./storage";

export const MAX_EDGE = 1600;
export const MAX_BYTES = 300 * 1024;
export const MAX_ATTEMPTS = 3;
export const BATCH = 20;
// Bậc chất lượng chép từ mgst-app: dừng ở bậc đầu tiên lọt trần, ảnh nền phẳng đạt ngay ở 85.
const QUALITY_STEPS = [85, 80, 75, 70];

export type CompressStore = {
  read: (key: string) => Promise<Uint8Array | null>;
  write: (key: string, bytes: Uint8Array) => Promise<void>;
  remove: (key: string) => Promise<void>;
};
export const s3CompressStore: CompressStore = { read: readImage, write: writeImage, remove: deleteImage };

const extOf = (key: string) => key.split(".").pop() ?? "";

// sharp treo khi đọc HEIC mã HEVC (libvips chỉ kèm bộ giải mã AV1), nên HEIC qua heic-convert sang JPEG trước.
export async function toWebp(bytes: Uint8Array, ext: string): Promise<Uint8Array> {
  const src = Buffer.from(ext === "heic" ? await convert({ buffer: bytes, format: "JPEG", quality: 0.92 }) : bytes);
  let out = Buffer.alloc(0);
  for (const quality of QUALITY_STEPS) {
    // failOn none: JPEG thiếu vài byte cuối vẫn dựng được phần đã có, như mgst-app.
    out = await sharp(src, { failOn: "none" }).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
    if (out.length <= MAX_BYTES) break;
  }
  return new Uint8Array(out);
}

// Ảnh nén lỗi 3 lần vẫn nằm trong chỉ mục compressed_at is null, nên phải lọc số lần thử ở đây.
export async function compressQueue(limit = BATCH): Promise<string[]> {
  const rows = await db
    .select({ id: proofPhotos.id })
    .from(proofPhotos)
    .where(and(isNull(proofPhotos.compressedAt), lt(proofPhotos.compressAttempts, MAX_ATTEMPTS)))
    .orderBy(asc(proofPhotos.createdAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

export type CompressOutcome = "compressed" | "kept" | "failed" | "skipped";

// Khoá dòng ảnh suốt lúc nén: worker khác bỏ qua dòng đang khoá (skip locked), mỗi ảnh chỉ một bên ghi.
export async function compressOne(id: string, store: CompressStore = s3CompressStore): Promise<CompressOutcome> {
  const keys: { source: string | null; written: string | null } = { source: null, written: null };
  let outcome: CompressOutcome;
  try {
    outcome = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ key: proofPhotos.s3Key, size: proofPhotos.sizeBytes, attempts: proofPhotos.compressAttempts })
        .from(proofPhotos)
        .where(and(eq(proofPhotos.id, id), isNull(proofPhotos.compressedAt), lt(proofPhotos.compressAttempts, MAX_ATTEMPTS)))
        .for("update", { skipLocked: true });
      if (!row) return "skipped";
      keys.source = row.key;
      const ext = extOf(row.key);
      if (ext === "webp" && row.size !== null && row.size <= MAX_BYTES) {
        await tx.update(proofPhotos).set({ compressedAt: new Date() }).where(eq(proofPhotos.id, id));
        return "kept";
      }
      try {
        const bytes = await store.read(row.key);
        if (!bytes) throw new Error("Không tải được ảnh từ S3.");
        const out = await toWebp(bytes, ext);
        // Giữ thư mục, ngày và uuid, chỉ đổi đuôi: ảnh đã là webp thì ghi đè đúng khoá cũ.
        const key = row.key.replace(/\.[a-z]+$/, ".webp");
        await store.write(key, out);
        keys.written = key;
        await tx.update(proofPhotos).set({ s3Key: key, sizeBytes: out.length, compressedAt: new Date() }).where(eq(proofPhotos.id, id));
        return "compressed";
      } catch (e) {
        console.error("[compress] không nén được ảnh", id, e);
        await tx.update(proofPhotos).set({ compressAttempts: row.attempts + 1 }).where(eq(proofPhotos.id, id));
        return "failed";
      }
    });
  } catch (e) {
    // Transaction lỗi sau khi đã ghi khoá mới: dòng vẫn trỏ khoá cũ, object mới thành rác.
    const { source, written } = keys;
    if (written && written !== source) await store.remove(written).catch(() => undefined);
    throw e;
  }
  // Xoá ảnh gốc sau commit: transaction lỗi thì dòng vẫn trỏ ảnh gốc còn nguyên.
  const { source, written } = keys;
  if (outcome === "compressed" && source && written && source !== written) {
    await store.remove(source).catch((e) => console.error("[compress] không xoá được ảnh gốc trên S3:", source, e));
  }
  return outcome;
}

// Một vòng của worker; stopped() đúng thì dừng sau ảnh đang nén, không bỏ dở dòng nào.
export async function runCompressQueue(store: CompressStore = s3CompressStore, stopped: () => boolean = () => false): Promise<Record<CompressOutcome, number>> {
  const tally: Record<CompressOutcome, number> = { compressed: 0, kept: 0, failed: 0, skipped: 0 };
  for (const id of await compressQueue()) {
    if (stopped()) break;
    tally[await compressOne(id, store)] += 1;
  }
  return tally;
}
