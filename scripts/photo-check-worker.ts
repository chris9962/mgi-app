import { Client } from "pg";
import { pool } from "../src/server/db/client";
import { closeOcr } from "../src/server/ocr/reader";
import { BATCH, PHOTO_CHECK_CHANNEL, runPhotoCheckRound } from "../src/server/photoCheckWorker";

// Worker kiểm ảnh: nghe kênh photo_checks, quét lại mỗi 30 giây để bắt lượt bỏ lỡ lúc worker tắt hoặc lượt của worker đã chết.
// Chạy tiến trình riêng để lỗi đọc ảnh không kéo theo worker SMS. Cờ --mot-vong: chạy một vòng rồi thoát, dùng cho test và e2e.
const SCAN_MS = 30_000;

let stopping = false;

async function round(): Promise<boolean> {
  try {
    const t = await runPhotoCheckRound(undefined, () => stopping);
    if (t.done || t.failed || t.dropped) console.log(`[photo-check-worker] xong ${t.done}, lỗi ${t.failed}, bỏ ${t.dropped}`);
    return t.done + t.failed + t.dropped + t.skipped >= BATCH;
  } catch (e) {
    console.error("[photo-check-worker] vòng kiểm lỗi:", e);
    return false;
  }
}

async function main() {
  if (process.argv.includes("--mot-vong")) {
    await round();
    return;
  }
  const listener = new Client({ connectionString: process.env.DATABASE_URL });
  // Mất kết nối LISTEN thì thoát để trình quản lý tiến trình chạy lại, không chạy tiếp mà điếc thông báo.
  listener.on("error", (e) => {
    console.error("[photo-check-worker] mất kết nối LISTEN:", e);
    process.exit(1);
  });
  await listener.connect();
  await listener.query(`LISTEN ${PHOTO_CHECK_CHANNEL}`);
  let wake: (() => void) | null = null;
  let notified = false;
  listener.on("notification", () => {
    notified = true;
    wake?.();
  });
  // Dừng sau lượt đang đọc: kết quả ghi bằng một câu update nên lượt không bao giờ dở dang.
  const stop = () => {
    stopping = true;
    wake?.();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  console.log("[photo-check-worker] đang chạy");
  while (!stopping) {
    notified = false;
    const full = await round();
    if (stopping || full || notified) continue;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, SCAN_MS);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    wake = null;
  }
  await listener.end().catch(() => undefined);
}

main()
  .then(async () => {
    await closeOcr();
    await pool.end().catch(() => undefined);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
