import { Client } from "pg";
import { pool } from "../src/server/db/client";
import { runSmsQueue } from "../src/server/sms/queue";

// Worker SMS: nghe kênh sms_messages, quét lại mỗi 30 giây để bắt tin bỏ lỡ lúc worker tắt hoặc tin chờ thử lại.
const SCAN_MS = 30_000;

let running = false;
let again = false;

async function tick() {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      const t = await runSmsQueue();
      if (t.sent || t.retry || t.failed) console.log(`[sms-worker] gửi ${t.sent}, chờ thử lại ${t.retry}, lỗi ${t.failed}`);
    } while (again);
  } catch (e) {
    console.error("[sms-worker] vòng gửi lỗi:", e);
  } finally {
    running = false;
  }
}

async function main() {
  const listener = new Client({ connectionString: process.env.DATABASE_URL });
  // Mất kết nối LISTEN thì thoát để trình quản lý tiến trình chạy lại, không chạy tiếp mà điếc thông báo.
  listener.on("error", (e) => {
    console.error("[sms-worker] mất kết nối LISTEN:", e);
    process.exit(1);
  });
  await listener.connect();
  await listener.query("LISTEN sms_messages");
  listener.on("notification", () => void tick());
  const timer = setInterval(() => void tick(), SCAN_MS);
  const stop = async () => {
    clearInterval(timer);
    await listener.end().catch(() => undefined);
    await pool.end().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  console.log("[sms-worker] đang chạy");
  await tick();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
