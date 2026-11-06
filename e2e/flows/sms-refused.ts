import { pool } from "../../src/server/db/client";
import { runSmsQueue } from "../../src/server/sms/queue";
import { sendSms } from "../../src/server/sms/send";
import { E2E_STUDENT_SCHOOL_ID } from "../../scripts/e2e-data";

// Nhà cung cấp SMS chưa nối nên không có lỗi thật: hàm gửi này từ chối một SĐT, số khác gửi như worker.
const [phone, rounds = "3"] = process.argv.slice(2);
const send: typeof sendSms = async (to, body) => (to === phone ? { ok: false, error: "Nhà mạng từ chối số này" } : sendSms(to, body));
for (let i = 1; i <= Number(rounds); i++) {
  const t = await runSmsQueue(send, [E2E_STUDENT_SCHOOL_ID]);
  console.log(`[sms-refused] vòng ${i}: gửi ${t.sent}, chờ thử lại ${t.retry}, lỗi ${t.failed}`);
}
await pool.end();
