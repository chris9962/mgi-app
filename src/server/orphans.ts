import { inArray } from "drizzle-orm";
import { db } from "./db/client";
import { proofPhotos } from "./db/schema";
import { deleteImage, listObjects } from "./storage";

// Ảnh đã ghi lên S3 mà transaction ghi dòng proof_photos lỗi thì object nằm lại không ai trỏ tới.
// Chỉ xoá object cũ hơn mốc (mặc định 24 giờ ở script): object mới có thể thuộc transaction chưa commit.
export async function sweepOrphanProofs(opts: { prefix?: string; olderThan: Date; dryRun?: boolean }): Promise<{ scanned: number; orphans: string[]; removed: string[] }> {
  const prefix = opts.prefix ?? "proofs/";
  if (!prefix.startsWith("proofs/")) throw new Error("Chỉ dọn thư mục proofs/.");
  const orphans: string[] = [];
  let scanned = 0;
  let batch: string[] = [];
  const check = async () => {
    if (!batch.length) return;
    const used = new Set((await db.select({ key: proofPhotos.s3Key }).from(proofPhotos).where(inArray(proofPhotos.s3Key, batch))).map((r) => r.key));
    orphans.push(...batch.filter((k) => !used.has(k)));
    batch = [];
  };
  for await (const o of listObjects(prefix)) {
    scanned += 1;
    if (o.at >= opts.olderThan) continue;
    batch.push(o.key);
    if (batch.length >= 500) await check();
  }
  await check();
  const removed: string[] = [];
  if (!opts.dryRun) {
    for (const key of orphans) {
      await deleteImage(key);
      removed.push(key);
    }
  }
  return { scanned, orphans, removed };
}
