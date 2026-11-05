import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { cpus, freemem, totalmem } from "node:os";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

// Chép từ mgst-app scripts/ops-watch.ts, tách hàm đọc chữ ra để test không cần máy Linux.

export type CpuSample = { idle: number; total: number };
export type Usage = { used: number; total: number };

export function parseCpuSample(procStat: string): CpuSample | null {
  const line = procStat.split("\n").find((l) => l.startsWith("cpu "));
  if (!line) return null;
  const parts = line.trim().split(/\s+/).slice(1).map(Number).filter(Number.isFinite);
  if (parts.length < 5) return null;
  // Cột 4 là idle, cột 5 là iowait: máy đang chờ đĩa thì CPU vẫn rảnh.
  return { idle: parts[3] + parts[4], total: parts.reduce((a, b) => a + b, 0) };
}

export function cpuPercentBetween(before: CpuSample, after: CpuSample): number {
  const total = after.total - before.total;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, ((total - (after.idle - before.idle)) / total) * 100));
}

// Không dùng MemFree: Linux mượn RAM rảnh làm bộ đệm đĩa, MemFree luôn gần 0 trên máy chạy lâu.
export function parseMeminfo(text: string): Usage | null {
  const kb = (key: string) => Number(text.split("\n").find((l) => l.startsWith(`${key}:`))?.replace(/\D+/g, "") ?? 0);
  const total = kb("MemTotal") * 1024;
  if (total <= 0) return null;
  return { used: total - kb("MemAvailable") * 1024, total };
}

export function parseDf(output: string): Usage | null {
  const cols = output.trim().split("\n")[1]?.trim().split(/\s+/);
  if (!cols || cols.length < 4) return null;
  const total = Number(cols[1]) * 1024;
  const used = Number(cols[2]) * 1024;
  return Number.isFinite(total) && Number.isFinite(used) && total > 0 ? { used, total } : null;
}

// Máy chủ là Linux; nhánh os chỉ để chạy thử ops-watch trên máy macOS của người lập trình.
export async function readCpuSample(): Promise<CpuSample | null> {
  const text = await readFile("/proc/stat", "utf8").catch(() => "");
  if (text) return parseCpuSample(text);
  const all = cpus().map((c) => c.times);
  if (!all.length) return null;
  return all.reduce((s, t) => ({ idle: s.idle + t.idle, total: s.total + t.user + t.nice + t.sys + t.idle + t.irq }), { idle: 0, total: 0 });
}

export async function readMemory(): Promise<Usage | null> {
  const text = await readFile("/proc/meminfo", "utf8").catch(() => "");
  if (text) return parseMeminfo(text);
  return { used: totalmem() - freemem(), total: totalmem() };
}

export function readDisk(path: string): Usage | null {
  try {
    return parseDf(execFileSync("df", ["-kP", path], { encoding: "utf8" }));
  } catch {
    return null;
  }
}

// S3 không có lệnh đọc dung lượng bucket: cộng Size của mọi object, 1000 khoá một lượt gọi, nên chỉ đo mỗi giờ.
export async function measureS3(): Promise<{ bytes: number; objects: number } | null> {
  const endpoint = (process.env.S3_ENDPOINT ?? "").replace(/\/+$/, "");
  const { S3_REGION: region = "", S3_BUCKET: bucket = "", S3_ACCESS_KEY_ID: accessKeyId = "", S3_SECRET_ACCESS_KEY: secretAccessKey = "" } = process.env;
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) return null;
  const client = new S3Client({ endpoint, region, forcePathStyle: true, credentials: { accessKeyId, secretAccessKey } });
  let bytes = 0;
  let objects = 0;
  let token: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }), { abortSignal: AbortSignal.timeout(60_000) });
    for (const item of page.Contents ?? []) {
      bytes += item.Size ?? 0;
      objects += 1;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return { bytes, objects };
}
