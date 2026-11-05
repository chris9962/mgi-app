import { pool } from "../src/server/db/client";
import { sweepOrphanProofs } from "../src/server/orphans";

// Xoá object trong proofs/ không dòng proof_photos nào trỏ tới, chạy 03:30 mỗi ngày bằng mgi-bank-s3-orphans.timer.
// Cờ --dry-run: chỉ liệt kê. Biến ORPHAN_MIN_AGE_HOURS (24): object mới hơn ngần này giờ thì giữ.
async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const hours = Number(process.env.ORPHAN_MIN_AGE_HOURS) || 24;
  const r = await sweepOrphanProofs({ olderThan: new Date(Date.now() - hours * 3_600_000), dryRun });
  for (const key of r.orphans) console.log(`[s3-orphans] ${dryRun ? "sẽ xoá" : "đã xoá"} ${key}`);
  console.log(`[s3-orphans] quét ${r.scanned} object, ${r.orphans.length} mồ côi cũ hơn ${hours} giờ, xoá ${r.removed.length}.`);
}

main()
  .catch((e) => {
    console.error("[s3-orphans] HỎNG:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
