import { pool } from "../src/server/db/client";
import { cpuPercentBetween, measureS3, readCpuSample, readDisk, readMemory, type CpuSample } from "../src/server/hostProbe";
import { cleanupOps, recordHostMetrics } from "../src/server/ops";

// Đo máy chủ cho Trang 18, chép từ mgst-app scripts/ops-watch.ts, bỏ phần cảnh báo đẩy.
// Chạy thẳng trên máy chủ bằng systemd, không trong container: trong container thì df ra ổ đĩa của container.
// Cờ --mot-vong: chạy một vòng rồi thoát. Biến: OPS_WATCH_SLEEP (giây, 60), OPS_S3_EVERY_MINUTES (60), OPS_DISK_PATH (/), OPS_KEEP_DAYS (7).
const SLEEP_SECONDS = Number(process.env.OPS_WATCH_SLEEP) || 60;
const S3_EVERY_MINUTES = Number(process.env.OPS_S3_EVERY_MINUTES) || 60;
const DISK_PATH = process.env.OPS_DISK_PATH || "/";
const KEEP_DAYS = Number(process.env.OPS_KEEP_DAYS) || 7;

const log = (line: string) => console.log(`[ops-watch] ${new Date().toISOString()} ${line}`);

let lastCpu: CpuSample | null = null;
let lastS3At = 0;

async function runOnce() {
  // Một mẫu CPU không nói được gì: vòng đầu lấy thêm mẫu cách 1 giây, các vòng sau trừ với mẫu của vòng trước.
  const before = lastCpu ?? (await readCpuSample());
  if (!lastCpu) await new Promise((r) => setTimeout(r, 1000));
  const after = await readCpuSample();
  const memory = await readMemory();
  const disk = readDisk(DISK_PATH);
  if (!before || !after || !memory || !disk) {
    log("không đọc được CPU, RAM hoặc ổ đĩa, bỏ vòng này");
    return;
  }
  lastCpu = after;
  const dueS3 = Date.now() - lastS3At >= S3_EVERY_MINUTES * 60_000;
  const s3 = dueS3
    ? await measureS3().catch((e) => {
        log(`đo S3 lỗi: ${(e as Error).message}`);
        return null;
      })
    : null;
  if (s3) lastS3At = Date.now();
  await recordHostMetrics({ cpuPercent: cpuPercentBetween(before, after), ram: memory, disk, s3 });
  const removed = await cleanupOps(KEEP_DAYS);
  log(`ghi số đo${s3 ? ", có S3" : ""}; xoá ${removed.metrics} số đo cũ, ${removed.sessions} phiên hết hạn`);
}

async function main() {
  const once = process.argv.includes("--mot-vong");
  let stopping = false;
  let wake: (() => void) | null = null;
  const stop = () => {
    stopping = true;
    wake?.();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
  do {
    try {
      await runOnce();
    } catch (e) {
      log(`vòng đo lỗi: ${(e as Error).message}`);
    }
    if (once || stopping) break;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, SLEEP_SECONDS * 1000);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
    wake = null;
  } while (!stopping);
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
