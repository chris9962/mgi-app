import { afterAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { gt, inArray } from "drizzle-orm";
import { db } from "../../src/server/db/client";
import { hostMetrics } from "../../src/server/db/schema";

// Bỏ biến S3 để lượt chạy thử không duyệt cả bucket dev; lượt đo S3 có test riêng ở hàm đo.
const env = { ...process.env, S3_ENDPOINT: "", OPS_WATCH_SLEEP: "1" };
const watch = (...args: string[]) => spawn("bun", ["scripts/ops-watch.ts", ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
const exited = (child: ReturnType<typeof watch>) => new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
const written: number[] = [];

afterAll(async () => {
  if (written.length) await db.delete(hostMetrics).where(inArray(hostMetrics.id, written));
});

describe("scripts/ops-watch.ts", () => {
  test("--mot-vong ghi một dòng số đo CPU, RAM, ổ đĩa rồi thoát mã 0", async () => {
    const since = new Date();
    expect(await exited(watch("--mot-vong"))).toBe(0);
    const rows = await db.select().from(hostMetrics).where(gt(hostMetrics.at, since));
    written.push(...rows.map((r) => r.id));
    expect(rows).toHaveLength(1);
    const [r] = rows;
    expect(Number(r.cpuPercent)).toBeGreaterThanOrEqual(0);
    expect(r.ramTotal).toBeGreaterThan(r.ramUsed);
    expect(r.diskTotal).toBeGreaterThan(r.diskUsed);
    expect(r.s3At).toBeNull();
  }, 30_000);

  test("SIGTERM thì dừng sau vòng đang chạy và thoát mã 0", async () => {
    const since = new Date();
    const child = watch();
    let out = "";
    child.stdout!.on("data", (d) => (out += d));
    const done = exited(child);
    while (!out.includes("ghi số đo")) await new Promise((r) => setTimeout(r, 50));
    child.kill("SIGTERM");
    expect(await done).toBe(0);
    written.push(...(await db.select({ id: hostMetrics.id }).from(hostMetrics).where(gt(hostMetrics.at, since))).map((r) => r.id));
  }, 30_000);
});
