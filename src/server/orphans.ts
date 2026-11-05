import { count, inArray } from "drizzle-orm";
import { db } from "./db/client";
import { proofPhotos } from "./db/schema";
import { orphanGuard } from "./orphanGuard";
import { deleteImage, listObjects } from "./storage";

// Ảnh đã ghi lên S3 mà transaction ghi dòng proof_photos lỗi thì object nằm lại không ai trỏ tới.
// Chỉ xoá object cũ hơn mốc (mặc định 24 giờ ở script): object mới có thể thuộc transaction chưa commit.
// force: người vận hành đã xem danh sách chạy khô và xác nhận số ảnh mồ côi lớn là thật.
export async function sweepOrphanProofs(opts: { prefix?: string; olderThan: Date; dryRun?: boolean; force?: boolean }): Promise<{ scanned: number; orphans: string[]; removed: string[]; blocked: string | null }> {
  const prefix = opts.prefix ?? "proofs/";
  if (!prefix.startsWith("proofs/")) throw new Error("Chỉ dọn thư mục proofs/.");
  const orphans: string[] = [];
  let scanned = 0;
  let candidates = 0;
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
    candidates += 1;
    batch.push(o.key);
    if (batch.length >= 500) await check();
  }
  await check();
  const [{ dbRows }] = await db.select({ dbRows: count() }).from(proofPhotos);
  const blocked = opts.force ? null : orphanGuard({ candidates, orphans: orphans.length, dbRows });
  if (blocked && !opts.dryRun) throw new Error(`DỪNG, không xoá ảnh nào. ${blocked} Xem danh sách bằng --dry-run, chắc chắn thì chạy lại với --bo-chan.`);
  const removed: string[] = [];
  if (!opts.dryRun) {
    for (const key of orphans) {
      await deleteImage(key);
      removed.push(key);
    }
  }
  return { scanned, orphans, removed, blocked };
}
