import { backupS3, newestBackup } from "./lib/backup";

// Kiểm bản sao lưu mới nhất có quá cũ không, chạy 08:00 bằng mgi-bank-backup-check.timer.
// Timer sao lưu chết hẳn (bị disable, máy chủ dừng lâu) thì không có lượt nào để hỏng: câu hỏi "bản mới nhất bao nhiêu tuổi" phải đến từ bên ngoài.
// Ngưỡng 10 giờ: sao lưu chạy 06:00 tới 23:00, khoảng trống dài nhất là 23:00 tới 06:00 hôm sau, tức 7 giờ.
function fail(message: string): never {
  console.error(`[backup-check] HỎNG: ${message}`);
  process.exit(1);
}

async function main() {
  const maxHours = Number(process.env.BACKUP_MAX_AGE_HOURS) || 10;
  const s3 = backupS3();
  const newest = await newestBackup(s3);
  if (!newest) fail(`bucket ${s3.bucket} không có bản sao lưu nào`);
  const hours = (Date.now() - newest.at.getTime()) / 3_600_000;
  const line = `${newest.key}, ${Math.round(newest.size / 1024)} KB, ${hours.toFixed(1)} giờ tuổi`;
  if (hours > maxHours) fail(`bản mới nhất quá ${maxHours} giờ tuổi: ${line}`);
  console.log(`[backup-check] đạt: ${line}`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
