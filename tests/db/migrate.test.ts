import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createDatabase, dbTarget, dropDatabase } from "../../scripts/lib/backup";

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

  test("database mới tinh chưa có bảng migration: chạy đủ mọi migration", () => {
    const url = new URL(process.env.DATABASE_URL!);
    const { user } = dbTarget(url.toString());
    const fresh = `zz_test_migrate_${Date.now()}`;
    createDatabase("mgi-bank-db", user, fresh);
    try {
      url.pathname = `/${fresh}`;
      const r = Bun.spawnSync(["bun", "scripts/db-migrate.ts"], { env: { ...process.env, DATABASE_URL: url.toString() } });
      expect(r.stderr.toString()).toBe("");
      expect(r.exitCode).toBe(0);
      expect(r.stdout.toString()).toContain(`${journal.entries.length} migration mới, tổng ${journal.entries.length}`);
    } finally {
      dropDatabase("mgi-bank-db", user, fresh);
    }
  }, 60_000);
});
