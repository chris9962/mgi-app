import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { appContainersFor, backupS3, createDatabase, dbTarget, downloadBackup, dropDatabase, listBackups, recreateDatabase, restoreDump, tableCounts, validateDump } from "./lib/backup";

// Khôi phục DB từ bản sao lưu, chép cách gọi của mgst-app:
//   bun run db:restore                         liệt kê bản đang có, không khôi phục
//   bun run db:restore -- <khoá|file> --thu    khôi phục vào database <tên>_thu, so số dòng với database thật
//   bun run db:restore -- <khoá|file> --that=<tên database>   khôi phục đè database thật; gõ lại đúng tên database trong DATABASE_URL,
//                                                           phải dừng app, worker, ops-watch, timer dọn ảnh trước
// Mặc định là --thu: dump hỏng mà khôi phục đè thì mất cả hai thứ cùng lúc.
function fail(message: string): never {
  console.error(`[restore] ${message}`);
  process.exit(1);
}

const running = (name: string) => spawnSync("docker", ["ps", "-q", "--filter", `name=^${name}$`, "--filter", "status=running"], { encoding: "utf8" }).stdout.trim() !== "";

async function main() {
  const s3 = backupS3();
  const args = process.argv.slice(2);
  const source = args.find((a) => !a.startsWith("--"));
  const thatFlag = args.find((a) => a === "--that" || a.startsWith("--that="));
  const real = thatFlag !== undefined;
  const container = process.env.BACKUP_DB_CONTAINER || "mgi-bank-db";
  const target = dbTarget(process.env.DATABASE_URL ?? "");

  if (!source) {
    const rows = (await listBackups(s3)).sort((a, b) => b.key.localeCompare(a.key));
    console.log(`${rows.length} bản sao lưu trong s3://${s3.bucket}`);
    for (const r of rows.slice(0, 30)) console.log(`  ${r.key.padEnd(48)} ${String(Math.round(r.size / 1024)).padStart(7)} KB`);
    console.log(`Khôi phục thử: bun run db:restore -- ${rows[0]?.key ?? "<khoá>"} --thu`);
    return;
  }

  if (real) {
    // Gõ lại tên: DATABASE_URL của shell thắng .env.local, người chạy phải thấy và xác nhận đúng database sắp bị xoá.
    const typed = thatFlag.slice("--that=".length);
    if (thatFlag === "--that") fail(`Gõ lại tên database sắp bị xoá để xác nhận: --that=${target.database}`);
    if (typed !== target.database) fail(`Tên gõ lại "${typed}" không khớp database trong DATABASE_URL (${target.database}). Không xoá gì.`);
    const busy = appContainersFor(container).filter(running);
    if (busy.length) fail(`Dừng ${busy.join(", ")} trước khi khôi phục đè: chúng đang ghi vào database sắp bị thay.`);
  }

  const file = source.startsWith("/") ? source : path.join(tmpdir(), "mgi-bank-restore.dump");
  if (source.startsWith("/")) {
    if (!existsSync(file)) fail(`Không có file ${file}`);
  } else {
    console.log(`[restore] tải s3://${s3.bucket}/${source}`);
    console.log(`[restore] tải xong ${Math.round((await downloadBackup(s3, source, file)) / 1024)} KB`);
  }

  // Kiểm file trước khi đụng database: bản dump của mgst-app hay file cắt cụt thì dừng khi chưa xoá gì.
  validateDump(container, file);

  const into = real ? target.database : `${target.database}_thu`;
  if (real) {
    console.log(`[restore] XOÁ rồi tạo lại database ${into}, khôi phục từ bản dump sau 10 giây. Bấm Ctrl+C để thôi.`);
    await new Promise((r) => setTimeout(r, 10_000));
    recreateDatabase(container, target);
  } else {
    dropDatabase(container, target.user, into);
    createDatabase(container, target.user, into);
  }
  try {
    restoreDump(container, target.user, file, into);
  } catch (e) {
    fail(
      `KHÔNG ĐẠT. ${e instanceof Error ? e.message : String(e)}\n` +
        `Database ${into} lúc này RỖNG: pg_restore chạy trong một transaction nên lỗi thì lùi hết. ` +
        (real ? "Không bật app và worker trên database này. Chạy lại lệnh với bản sao lưu khác: bun run db:restore liệt kê các bản." : "Bản thử hỏng, database thật không đổi."),
    );
  }
  if (!source.startsWith("/")) rmSync(file, { force: true });

  const restored = tableCounts(container, target.user, into);
  const live = real ? restored : tableCounts(container, target.user, target.database);
  console.log(`\n${"Bảng".padEnd(36)} ${into.padStart(12)} ${target.database.padStart(12)}`);
  for (const name of Object.keys({ ...live, ...restored }).sort()) {
    console.log(`${name.padEnd(36)} ${String(restored[name] ?? "-").padStart(12)} ${String(live[name] ?? "-").padStart(12)}`);
  }
  if (!real) console.log(`\nSo xong thì xoá bản thử: docker exec ${container} psql -U ${target.user} -d postgres -c "drop database ${into}"`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
