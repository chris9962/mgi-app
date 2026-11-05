import { pool } from "../src/server/db/client";
import { BATCH, runCompressQueue } from "../src/server/compress";

// Worker nén ảnh: quét mỗi 30 giây. Ảnh gốc xem được ngay nên không cần nghe LISTEN như worker kiểm ảnh.
// Cờ --mot-vong: chạy một vòng rồi thoát, dùng cho test và e2e.
const SCAN_MS = 30_000;

let stopping = false;

async function round(): Promise<boolean> {
  try {
    const t = await runCompressQueue(undefined, () => stopping);
    if (t.compressed || t.kept || t.failed) console.log(`[compress-worker] nén ${t.compressed}, giữ ${t.kept}, lỗi ${t.failed}`);
    return t.compressed + t.kept + t.failed + t.skipped >= BATCH;
  } catch (e) {
    console.error("[compress-worker] vòng nén lỗi:", e);
    return false;
  }
}

async function main() {
  if (process.argv.includes("--mot-vong")) {
    await round();
    return;
  }
  let wake: (() => void) | null = null;
  // Dừng sau ảnh đang nén: dòng ảnh ghi trong một transaction nên không bao giờ dở dang.
  const stop = () => {
    stopping = true;
    wake?.();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  console.log("[compress-worker] đang chạy");
  while (!stopping) {
    const full = await round();
    if (stopping || full) continue;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, SCAN_MS);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    wake = null;
  }
}

main()
  .then(async () => {
    await pool.end().catch(() => undefined);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
