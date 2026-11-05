import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { backupFileName, backupKey, backupS3, dbTarget, dumpDatabase, pruneBackups, uploadBackup } from "./lib/backup";

// Sao lưu DB lên bucket sao lưu, chạy trên máy chủ bằng timer mgi-bank-backup.timer (docs/deploy.md mục Sao lưu).
// Biến: BACKUP_S3_BUCKET (bắt buộc, khác bucket ảnh), BACKUP_S3_* (thiếu thì dùng S3_*), BACKUP_DB_CONTAINER (mgi-bank-db),
// BACKUP_LOCAL_DIR (/root/mgi-bank-backup), BACKUP_KEEP_LOCAL (18 file), BACKUP_KEEP_DAYS (7 ngày trên S3).
function fail(message: string): never {
  console.error(`[backup] HỎNG: ${message}`);
  process.exit(1);
}

async function main() {
  const s3 = backupS3();
  const target = dbTarget(process.env.DATABASE_URL ?? "");
  const container = process.env.BACKUP_DB_CONTAINER || "mgi-bank-db";
  const localDir = process.env.BACKUP_LOCAL_DIR || "/root/mgi-bank-backup";
  const keepLocal = Number(process.env.BACKUP_KEEP_LOCAL) || 18;
  const keepDays = Number(process.env.BACKUP_KEEP_DAYS) || 7;

  const now = new Date();
  mkdirSync(localDir, { recursive: true });
  const file = path.join(localDir, backupFileName(now));
  dumpDatabase(container, target, file);
  console.log(`[backup] dump xong ${file} (${Math.round(statSync(file).size / 1024)} KB)`);

  const key = backupKey(now);
  await uploadBackup(s3, key, file);
  console.log(`[backup] đã lên s3://${s3.bucket}/${key}`);

  const local = readdirSync(localDir).filter((f) => /^mgi-bank-.*\.dump$/.test(f)).sort().reverse();
  for (const old of local.slice(keepLocal)) rmSync(path.join(localDir, old));
  const removed = await pruneBackups(s3, now, keepDays);
  console.log(`[backup] XONG. Xoá ${Math.max(0, local.length - keepLocal)} file cũ trên đĩa, ${removed} bản cũ hơn ${keepDays} ngày trên S3.`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
