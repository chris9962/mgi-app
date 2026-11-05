import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const journal = JSON.parse(readFileSync(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8")) as { entries: unknown[] };

describe("scripts/db-migrate.ts", () => {
  test("in database đang nối (host:cổng/tên, không in mật khẩu) và số migration đã chạy", () => {
    const url = new URL(process.env.DATABASE_URL!);
    const r = Bun.spawnSync(["bun", "scripts/db-migrate.ts"], { env: { ...process.env } });
    const out = r.stdout.toString();
    expect(r.exitCode).toBe(0);
    expect(out).toContain(`${url.hostname}:${url.port}${url.pathname}`);
    expect(out).toContain(`0 migration mới, tổng ${journal.entries.length}`);
    expect(out).not.toContain(`:${url.password}@`);
    expect(out).not.toContain("postgres://");
  });
});
